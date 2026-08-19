<!-- src/views/ScheduleExam.vue -->
<template>
  <div class="schedule-exam-page">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">{{ isReschedule ? 'Reschedule Exam' : 'Schedule Exam' }}</h1>
        <p class="page-subtitle">{{ isReschedule ? 'Select a new date and time for your exam' : 'Select a proctor and time for your exam' }}</p>
        <button @click="$router.back()" class="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back to {{ isReschedule ? 'Appointment' : 'Exams' }}
        </button>
      </div>
    </div>

    <!-- Progress Steps -->
    <div class="progress-steps" v-if="!isReschedule">
      <div class="steps-container">
        <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
          <div class="step-number">1</div>
          <div class="step-label">Select Exam</div>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
          <div class="step-number">2</div>
          <div class="step-label">Select Proctor</div>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: currentStep === 3, completed: currentStep > 3 }">
          <div class="step-number">3</div>
          <div class="step-label">Select Date & Time</div>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: currentStep === 4, completed: currentStep > 4 }">
          <div class="step-number">4</div>
          <div class="step-label">Confirm Booking</div>
        </div>
      </div>
    </div>

    <!-- Reschedule Progress Steps -->
    <div class="progress-steps" v-else>
      <div class="steps-container">
        <div class="step" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
          <div class="step-number">1</div>
          <div class="step-label">Current Appointment</div>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: currentStep === 2, completed: currentStep > 2 }">
          <div class="step-number">2</div>
          <div class="step-label">Select New Date & Time</div>
        </div>
        <div class="step-line"></div>
        <div class="step" :class="{ active: currentStep === 3, completed: currentStep > 3 }">
          <div class="step-number">3</div>
          <div class="step-label">Confirm Changes</div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-icon">❌</div>
      <h3>Error</h3>
      <p>{{ error }}</p>
      <button @click="retryCurrentStep" class="retry-btn">Retry</button>
    </div>

    <!-- Step 1: Select Exam (only for new scheduling) -->
    <div v-else-if="!isReschedule && currentStep === 1" class="step-content">
      <div class="step-header">
        <h2>Select an Exam</h2>
        <p>Choose the exam you want to schedule</p>
      </div>

      <div class="exams-list">
        <div v-for="exam in availableExams" :key="exam.external_id"
             class="exam-option" :class="{
               selected: selectedExam?.external_id === exam.external_id,
               disabled: !canScheduleExam(exam)
             }"
             @click="canScheduleExam(exam) && selectExam(exam)">
          <div class="exam-option-icon" :class="{ disabled: !canScheduleExam(exam) }">
            <span v-if="hasExamPassed(exam)">🏆</span>
            <span v-else-if="hasActiveAppointment(exam)">⏰</span>
            <span v-else>📚</span>
          </div>
          <div class="exam-option-details">
            <h4>{{ exam.title }}</h4>
            <p>{{ exam.course_name || exam.course_id }} • {{ exam.exam_duration }} minutes</p>
            <div v-if="hasExamPassed(exam)" class="exam-status passed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Exam already passed
            </div>
            <div v-else-if="hasActiveAppointment(exam)" class="exam-status scheduled">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Already scheduled for {{ getScheduledDate(exam) }}
            </div>
            <div v-else-if="hasFailedAppointment(exam)" class="exam-status failed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M10 14L12 12L10 10M12 12L14 14L12 12M12 12L14 10L12 12M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Previous attempt failed - You can reschedule
            </div>
          </div>
          <div class="exam-option-check">
            <div class="check-circle" v-if="selectedExam?.external_id === exam.external_id">✓</div>
            <div v-else-if="hasExamPassed(exam)" class="status-tag passed">PASSED</div>
            <div v-else-if="hasActiveAppointment(exam)" class="status-tag scheduled">BOOKED</div>
            <div v-else-if="hasFailedAppointment(exam)" class="status-tag failed">RETRY</div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button @click="cancelSchedule" class="btn-cancel">Cancel</button>
        <button @click="nextStep" :disabled="!selectedExam || !canScheduleExam(selectedExam)" class="btn-next">
          Next: Select Proctor
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Step 2: Select Proctor (only for new scheduling) -->
    <div v-else-if="!isReschedule && currentStep === 2" class="step-content">
      <div class="step-header">
        <h2>Select a Proctor</h2>
        <p>Choose an available proctor for your exam</p>
      </div>

      <div class="proctors-grid">
        <div v-for="proctor in proctors" :key="proctor.external_id"
             class="proctor-card" :class="{ selected: selectedProctor?.external_id === proctor.external_id }"
             @click="selectProctor(proctor)">
          <div class="proctor-avatar">
            {{ proctor.username.charAt(0).toUpperCase() }}
          </div>
          <div class="proctor-info">
            <h4>{{ proctor.username }}</h4>
            <p>{{ proctor.email }}</p>
            <div class="proctor-status" :class="{ active: proctor.is_active }">
              {{ proctor.is_active ? 'Active' : 'Inactive' }}
            </div>
          </div>
          <div class="proctor-check">
            <div class="check-circle" v-if="selectedProctor?.external_id === proctor.external_id">✓</div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button @click="prevStep" class="btn-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back
        </button>
        <button @click="nextStep" :disabled="!selectedProctor || !selectedProctor.is_active" class="btn-next">
          Next: Select Date & Time
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Step 1: Current Appointment (for rescheduling) -->
    <div v-else-if="isReschedule && currentStep === 1" class="step-content">
      <div class="step-header">
        <h2>Current Appointment Details</h2>
        <p>Review your current exam appointment</p>
      </div>

      <div class="current-appointment-details">
        <div class="appointment-card">
          <div class="appointment-header">
            <div class="appointment-icon">📅</div>
            <div class="appointment-title">
              <h3>{{ existingAppointment?.exam_title || 'Exam' }}</h3>
              <p>Currently scheduled</p>
            </div>
          </div>

          <div class="appointment-details">
            <div class="detail-section">
              <h4>Exam Information</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">Exam:</span>
                  <span class="value">{{ selectedExam?.title }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Course:</span>
                  <span class="value">{{ selectedExam?.course_name || selectedExam?.course_id }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Duration:</span>
                  <span class="value">{{ selectedExam?.exam_duration }} minutes</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h4>Proctor Information</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">Proctor:</span>
                  <span class="value">{{ selectedProctor?.username }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Email:</span>
                  <span class="value">{{ selectedProctor?.email }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Status:</span>
                  <span class="value status-active">Active</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <h4>Current Schedule</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="label">Date:</span>
                  <span class="value">{{ formatAppointmentDate(existingAppointment?.appointment_date) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Time:</span>
                  <span class="value">{{ formatAppointmentTime(existingAppointment?.appointment_date) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Status:</span>
                  <span class="value" :class="existingAppointment?.appointment_status?.toLowerCase()">
                    {{ existingAppointment?.appointment_status }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="reschedule-notice">
            <div class="notice-icon">⚠️</div>
            <div class="notice-content">
              <h4>Important Notes</h4>
              <ul>
                <li>You can reschedule up to 2 days before your current appointment</li>
                <li>The old time slot will become available for other students</li>
                <li>You will create a new appointment with the selected date/time</li>
                <li>The old appointment will be cancelled automatically</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button @click="cancelSchedule" class="btn-cancel">Cancel</button>
        <div class="action-buttons">
          <button @click="cancelAppointment" class="btn-danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Cancel Appointment
          </button>
          <button @click="nextStep" :disabled="!canRescheduleAppointment" class="btn-next">
            Continue to Reschedule
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Step 3/2: Select Date & Time (shared for both flows) -->
    <div v-else-if="isDateStep" class="step-content">
      <div class="step-header">
        <h2>Select Date & Time</h2>
        <p>Choose an available time slot for your exam</p>
        <div v-if="hasActiveAppointmentOnSelectedDate && !isReschedule" class="date-warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 9V11M12 15H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>You already have an appointment on this date. Please select another date.</span>
        </div>
      </div>

      <!-- No proctor to ask. Only reachable when rescheduling an appointment
           whose proctor has since been removed: without this the calendar sits
           there with nothing bookable on any date and no explanation. -->
      <div v-if="!selectedProctor" class="proctor-reselect">
        <div class="date-warning">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 9V11M12 15H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>
            {{ originalProctorMissing
              ? 'The proctor for this appointment is no longer available. Choose another to continue.'
              : 'Choose a proctor to see available dates and times.' }}
          </span>
        </div>
        <div class="proctors-grid">
          <div v-for="proctor in proctors" :key="proctor.external_id"
               class="proctor-card"
               @click="chooseProctorForReschedule(proctor)">
            <div class="proctor-avatar">{{ proctor.username.charAt(0).toUpperCase() }}</div>
            <div class="proctor-info">
              <h4>{{ proctor.username }}</h4>
              <p>{{ proctor.email }}</p>
              <div class="proctor-status" :class="{ active: proctor.is_active }">
                {{ proctor.is_active ? 'Active' : 'Inactive' }}
              </div>
            </div>
          </div>
          <div v-if="proctors.length === 0" class="no-slots">
            <p>No proctors are available right now.</p>
            <p>Please try again later or contact an administrator.</p>
          </div>
        </div>
      </div>

      <div v-else class="date-time-selector">
        <!-- Date Selector -->
        <div class="date-selector">
          <h3>Select Date</h3>
          <div class="calendar-container">
            <div class="calendar-header">
              <button @click="prevMonth" class="nav-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="current-month">{{ currentMonth }}</div>
              <button @click="nextMonth" class="nav-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="calendar-days">
              <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="day-header">
                {{ day }}
              </div>
              <div v-for="day in calendarDays" :key="day.date"
                   class="calendar-day"
                   :class="{
                     'available': day.isAvailable && !day.isPast,
                     'selected': selectedDate === day.date,
                     'today': day.isToday,
                     'past': day.isPast,
                     'disabled': !day.isAvailable || day.isPast || (!isReschedule && hasActiveAppointmentOnDate(day.date)),
                     'has-appointment': !isReschedule && hasActiveAppointmentOnDate(day.date)
                   }"
                   @click="selectDate(day)">
                <div class="day-number">{{ day.day }}</div>
                <div v-if="day.isAvailable && !day.isPast" class="day-availability">✓</div>
                <div v-if="!isReschedule && hasActiveAppointmentOnDate(day.date)" class="day-appointment">⏰</div>
              </div>
            </div>
          </div>

          <!-- Say what the calendar is showing. A month with no green dates is
               a normal answer (a proctor works a limited window), and without
               this line it reads as the page having failed to load. -->
          <div class="availability-note">
            <span v-if="availabilityLoading">Checking {{ selectedProctor?.username }}'s availability…</span>
            <span v-else-if="availabilityError" class="availability-note--error">
              {{ availabilityError }}
              <button type="button" class="link-btn" @click="retryAvailability">Retry</button>
            </span>
            <span v-else-if="bookableDatesInMonth > 0">
              {{ selectedProctor?.username }} has {{ bookableDatesInMonth }}
              bookable {{ bookableDatesInMonth === 1 ? 'date' : 'dates' }} in {{ currentMonth }}.
            </span>
            <span v-else class="availability-note--empty">
              {{ selectedProctor?.username }} has no availability in {{ currentMonth }} — use
              &lsaquo; and &rsaquo; to try another month.
            </span>
          </div>
        </div>

        <!-- Time Selector -->
        <div class="time-selector" v-if="selectedDate && (!hasActiveAppointmentOnSelectedDate || isReschedule)">
          <h3>
            Available Time Slots
            <span v-if="slotsLoading" class="slots-refreshing">refreshing…</span>
          </h3>
          <div class="time-slots">
            <div v-for="slot in availableTimeSlots" :key="slot.id"
                 class="time-slot" :class="{
                   selected: selectedTimeSlot?.id === slot.id,
                   unavailable: !slot.is_available
                 }"
                 @click="slot.is_available && selectTimeSlot(slot)">
              <div class="slot-time">{{ slot.startTime }} - {{ slot.endTime }}</div>
              <div class="slot-status" :class="{ 'available': slot.is_available, 'unavailable': !slot.is_available }">
                {{ slot.is_available ? 'Available' : 'Unavailable' }}
              </div>
            </div>
            <div v-if="availableTimeSlots.length === 0 && !slotsLoading" class="no-slots">
              <p>Every slot on this date has just been taken</p>
              <p>Pick another date marked ✓ on the calendar</p>
            </div>
          </div>
        </div>

        <div v-else-if="selectedDate && hasActiveAppointmentOnSelectedDate && !isReschedule" class="time-selector placeholder error">
          <h3>Date Not Available</h3>
          <div class="placeholder-message">
            <div class="error-icon">⚠️</div>
            <p>You already have an appointment on this date.</p>
            <p>Please select another date to schedule your exam.</p>
          </div>
        </div>

        <div v-else class="time-selector placeholder">
          <h3>Available Time Slots</h3>
          <div class="placeholder-message">
            <p>Please select a date to see available time slots</p>
          </div>
        </div>
      </div>

      <div class="step-actions">
        <button @click="prevStep" class="btn-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back
        </button>
        <button @click="nextStep" :disabled="!selectedDate || !selectedTimeSlot || (!isReschedule && hasActiveAppointmentOnSelectedDate) || !selectedTimeSlot.is_available" class="btn-next">
          {{ isReschedule ? 'Next: Confirm Changes' : 'Next: Confirm Booking' }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Step 4/3: Confirm Booking/Reschedule -->
    <div v-else-if="(!isReschedule && currentStep === 4) || (isReschedule && currentStep === 3)" class="step-content">
      <div class="step-header">
        <h2>{{ isReschedule ? 'Confirm Reschedule' : 'Confirm Booking' }}</h2>
        <p>{{ isReschedule ? 'Review and confirm your exam rescheduling' : 'Review and confirm your exam appointment' }}</p>
      </div>

      <div class="booking-summary">
        <!-- Current appointment details (for rescheduling) -->
        <div v-if="isReschedule && existingAppointment" class="current-appointment-section">
          <h3>Current Appointment</h3>
          <div class="appointment-comparison">
            <div class="old-appointment">
              <div class="comparison-label">Old Schedule</div>
              <div class="appointment-detail">
                <div class="detail-item">
                  <span class="label">Date:</span>
                  <span class="value">{{ formatAppointmentDate(existingAppointment.appointment_date) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Time:</span>
                  <span class="value">{{ formatAppointmentTime(existingAppointment.appointment_date) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Proctor:</span>
                  <span class="value">{{ existingAppointment.proctor_name || selectedProctor?.username }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Status:</span>
                  <span class="value">{{ existingAppointment.appointment_status }}</span>
                </div>
              </div>
            </div>
            <div class="arrow">→</div>
            <div class="new-appointment">
              <div class="comparison-label">New Schedule</div>
              <div class="appointment-detail">
                <div class="detail-item">
                  <span class="label">Date:</span>
                  <span class="value">{{ formatAppointmentDate(selectedDate) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Time:</span>
                  <span class="value">{{ selectedTimeSlot?.startTime }} - {{ selectedTimeSlot?.endTime }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Proctor:</span>
                  <span class="value">{{ selectedProctor?.username }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Status:</span>
                  <span class="value status-active">Scheduled</span>
                </div>
              </div>
            </div>
          </div>
          <div class="reschedule-note">
            <div class="note-icon">ℹ️</div>
            <div class="note-content">
              <p><strong>Note:</strong> A new appointment will be created and the old appointment will be cancelled.</p>
            </div>
          </div>
        </div>

        <!-- Summary card for new scheduling -->
        <div v-else class="summary-card">
          <div class="summary-section">
            <h3>Exam Details</h3>
            <div class="summary-item">
              <span class="label">Exam:</span>
              <span class="value">{{ selectedExam?.title }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Course:</span>
              <span class="value">{{ selectedExam?.course_name || selectedExam?.course_id }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Duration:</span>
              <span class="value">{{ selectedExam?.exam_duration }} minutes</span>
            </div>
          </div>

          <div class="summary-section">
            <h3>Proctor Details</h3>
            <div class="summary-item">
              <span class="label">Proctor:</span>
              <span class="value">{{ selectedProctor?.username }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Email:</span>
              <span class="value">{{ selectedProctor?.email }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Status:</span>
              <span class="value status-active">Active</span>
            </div>
          </div>

          <div class="summary-section">
            <h3>Appointment Details</h3>
            <div class="summary-item">
              <span class="label">Date:</span>
              <span class="value">{{ formatAppointmentDate(selectedDate) }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Time:</span>
              <span class="value">{{ selectedTimeSlot?.startTime }} - {{ selectedTimeSlot?.endTime }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Duration:</span>
              <span class="value">{{ selectedExam?.exam_duration }} minutes</span>
            </div>
          </div>
        </div>

        <div class="instructions-card">
          <h3>Important Instructions</h3>
          <ul class="instructions-list">
            <li>Arrive at least 10 minutes before your scheduled time</li>
            <li>Ensure you have a stable internet connection</li>
            <li>Prepare your identification document</li>
            <li>Make sure your webcam and microphone are working</li>
            <li>Clear your workspace of any prohibited materials</li>
            <li>The "Start Exam" button will appear 30 minutes before your appointment</li>
            <li v-if="!isReschedule">You can reschedule up to 2 days before the exam</li>
            <li v-if="isReschedule">Your old time slot will be made available to other students</li>
          </ul>
        </div>
      </div>

      <div class="step-actions">
        <button @click="prevStep" class="btn-back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back
        </button>
        <button @click="confirmBooking" :disabled="bookingInProgress" class="btn-confirm">
          <span v-if="!bookingInProgress">
            {{ isReschedule ? 'Confirm Reschedule' : 'Confirm Booking' }}
          </span>
          <span v-else class="booking-loading">Processing...</span>
          <svg v-if="!bookingInProgress" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccessModal" class="modal-overlay" @click.self="closeSuccessModal">
      <div class="modal-content success-modal">
        <div class="success-icon">✓</div>
        <h3>{{ isReschedule ? 'Appointment Rescheduled!' : 'Booking Confirmed!' }}</h3>
        <p>{{ isReschedule ? 'Your exam has been successfully rescheduled.' : 'Your exam has been successfully scheduled.' }}</p>

        <div class="success-details">
          <div class="detail-item">
            <span class="label">Exam:</span>
            <span class="value">{{ selectedExam?.title }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Date & Time:</span>
            <span class="value">{{ formatAppointmentDateTime() }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Proctor:</span>
            <span class="value">{{ selectedProctor?.username }}</span>
          </div>
        </div>

        <!-- The booking is real; only the slot reservation failed. Said here
             rather than as an error, which would read as the exam not being
             booked at all. -->
        <div v-if="slotReserveWarning" class="success-warning">
          <span class="success-warning__icon" aria-hidden="true">⚠️</span>
          <span>{{ slotReserveWarning }}</span>
        </div>

        <div class="success-actions">
          <button @click="goToExams" class="btn-primary">View My Exams</button>
          <!-- Offered after a NEW booking too, now that the created appointment is
               kept: this is the page with the room links and the countdown, so it
               is the more useful of the two destinations. -->
          <button v-if="bookedAppointment || existingAppointment"
                  @click="goToAppointment" class="btn-secondary">View Appointment</button>
          <button v-if="!isReschedule" @click="closeSuccessModal" class="btn-secondary">Schedule Another</button>
        </div>
      </div>
    </div>

    <!-- Cancel Appointment Modal -->
    <div v-if="showCancelModal" class="modal-overlay" @click.self="showCancelModal = false">
      <div class="modal-content cancel-modal">
        <div class="cancel-icon">⚠️</div>
        <h3>Cancel Appointment</h3>
        <p>Are you sure you want to cancel this exam appointment?</p>

        <div class="cancel-details">
          <div class="detail-item">
            <span class="label">Exam:</span>
            <span class="value">{{ selectedExam?.title }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Date & Time:</span>
            <span class="value">{{ formatAppointmentDateTime() }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Proctor:</span>
            <span class="value">{{ selectedProctor?.username }}</span>
          </div>
        </div>

        <div class="cancel-warning">
          <p><strong>Note:</strong> This action cannot be undone. The time slot will be made available for other students.</p>
        </div>

        <div class="cancel-actions">
          <button @click="showCancelModal = false" class="btn-secondary">Go Back</button>
          <button @click="confirmCancel" :disabled="cancelling" class="btn-danger">
            <span v-if="!cancelling">Yes, Cancel Appointment</span>
            <span v-else class="cancelling-loading">Cancelling...</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, type Exam, type ExamAppointment, type UserExamResult } from '@/services/exam.service';
import { proctorService, type ExamProctor, type AvailableDay, type AvailableHour } from '@/services/proctor.service';
import { notificationService } from '@/services/notification.service';

// Import the CSS file
import '@/assets/css/schedule-exam.css';
// Structural + responsive fixes shared by the eight exam-system pages.
// Imported AFTER the page stylesheet on purpose - see the header of the file.
import '@/assets/css/exam-system.css';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// State management
const currentStep = ref(1);
const loading = ref(false);
const error = ref<string | null>(null);
const bookingInProgress = ref(false);
const cancelling = ref(false);
const showSuccessModal = ref(false);
const showCancelModal = ref(false);

// Data
const availableExams = ref<Exam[]>([]);
const selectedExam = ref<Exam | null>(null);
const userAppointments = ref<ExamAppointment[]>([]);
const userExamResults = ref<UserExamResult[]>([]);
const proctors = ref<ExamProctor[]>([]);
const selectedProctor = ref<ExamProctor | null>(null);
const currentDate = ref(new Date());
const selectedDate = ref<string | null>(null);
const selectedTimeSlot = ref<any>(null);
const availableTimeSlots = ref<any[]>([]);
const existingAppointment = ref<ExamAppointment | null>(null);

// The proctor's real availability for the months the calendar has shown, keyed
// by `YYYY-MM-DD`. A date that is not in here is a date the proctor does not
// work — which is what the calendar now paints, instead of marking every future
// day green and only admitting there are no slots after it has been clicked.
const availabilityByDate = ref<Record<string, AvailableDay>>({});
const loadedMonths = ref<string[]>([]);
const availabilityLoading = ref(false);
const availabilityError = ref<string | null>(null);
const slotsLoading = ref(false);
// The appointment being rescheduled names a proctor who no longer exists.
const originalProctorMissing = ref(false);
// The booking landed but the hour could not be marked taken - see handleNewBooking.
const slotReserveWarning = ref<string | null>(null);
// The appointment this visit created, so the success modal can link to it. NOT the
// same thing as `existingAppointment`, which is the one being rescheduled and is
// null for a new booking.
const bookedAppointment = ref<ExamAppointment | null>(null);

// Computed properties
const userId = computed(() => authStore.user?.id);
const username = computed(() => authStore.user?.username);
const isReschedule = computed(() => route.query.reschedule === 'true');
const appointmentId = computed(() => route.query.appointmentId as string);
const isDateStep = computed(() =>
  (!isReschedule.value && currentStep.value === 3) || (isReschedule.value && currentStep.value === 2)
);

const canRescheduleAppointment = computed(() => {
  if (!existingAppointment.value) return false;

  // Check if exam is already passed
  if (hasExamPassed(selectedExam.value)) {
    return false;
  }

  // Check appointment status - allow rescheduling for these statuses
  const reschedulableStatuses = ['Scheduled', 'In Progress', 'Taken but Failed', 'Cancelled', 'Expired'];
  return reschedulableStatuses.includes(existingAppointment.value.appointment_status);
});

const hasActiveAppointmentOnSelectedDate = computed(() => {
  if (!selectedDate.value || !userAppointments.value.length) return false;
  if (isReschedule.value) return false; // Allow rescheduling on same date

  const selectedDateObj = parseDate(selectedDate.value);
  return userAppointments.value.some(app => {
    const appDate = parseDate(app.appointment_date);
    return areDatesEqual(appDate, selectedDateObj) &&
           app.exam === selectedExam.value?.external_id &&
           isActiveAppointmentStatus(app.appointment_status);
  });
});

// Helper functions for date handling
const formatDate = (date: Date | string): string => {
  // A plain date string is already what we want. Round-tripping it through
  // `new Date()` parses it as UTC midnight and hands back the previous day for
  // anyone west of UTC — see the same note in proctor.service.ts.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return date.trim();
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (dateStr: string): Date => {
  if (dateStr.includes('T')) {
    return new Date(dateStr);
  }
  return new Date(`${dateStr}T12:00:00`);
};

const areDatesEqual = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

// Appointment status helpers
const isActiveAppointmentStatus = (status: string): boolean => {
  const activeStatuses = ['No Reservation Yet', 'Scheduled', 'In Progress', 'Taken but Failed', 'Expired'];
  return activeStatuses.includes(status);
};

const isCompletedPassedAppointment = (appointment: ExamAppointment): boolean => {
  if (appointment.appointment_status !== 'Completed') return false;

  // Check if there's a passed exam result for this appointment
  const examResult = userExamResults.value.find(
    result => result.exam === appointment.exam && result.result_status === 'PASSED'
  );

  return !!examResult;
};

// Exam eligibility helpers
const hasExamPassed = (exam: Exam | null): boolean => {
  if (!exam || !userExamResults.value.length) return false;

  return userExamResults.value.some(
    result => result.exam === exam.external_id && result.result_status === 'PASSED'
  );
};

const hasActiveAppointment = (exam: Exam): boolean => {
  if (!userAppointments.value.length) return false;

  return userAppointments.value.some(app =>
    app.exam === exam.external_id &&
    isActiveAppointmentStatus(app.appointment_status)
  );
};

const hasFailedAppointment = (exam: Exam): boolean => {
  if (!userAppointments.value.length) return false;

  return userAppointments.value.some(app =>
    app.exam === exam.external_id &&
    (app.appointment_status === 'Taken but Failed' ||
     app.appointment_status === 'Expired' ||
     app.appointment_status === 'Cancelled')
  );
};

const canScheduleExam = (exam: Exam): boolean => {
  // Cannot schedule if exam already passed
  if (hasExamPassed(exam)) return false;

  // Cannot schedule if there's an active appointment (Scheduled, In Progress)
  const hasActive = userAppointments.value.some(app =>
    app.exam === exam.external_id &&
    (app.appointment_status === 'Scheduled' || app.appointment_status === 'In Progress')
  );

  if (hasActive) return false;

  // Can schedule if no appointment or appointment is failed/expired/cancelled
  return true;
};

const hasActiveAppointmentOnDate = (date: string): boolean => {
  if (!userAppointments.value.length || !selectedExam.value) return false;
  if (isReschedule.value) return false; // Allow rescheduling on same date

  const checkDate = parseDate(date);
  return userAppointments.value.some(app => {
    const appDate = parseDate(app.appointment_date);
    return areDatesEqual(appDate, checkDate) &&
           app.exam === selectedExam.value?.external_id &&
           isActiveAppointmentStatus(app.appointment_status);
  });
};

// Calendar computed properties
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();

  const days = [];

  // Previous month days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    days.push({
      date: formatDate(date),
      day: date.getDate(),
      isCurrentMonth: false,
      isToday: areDatesEqual(date, today),
      isPast: date < today,
      isAvailable: false
    });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i);
    const dateStr = formatDate(date);
    const isToday = areDatesEqual(date, today);

    days.push({
      date: dateStr,
      day: i,
      isCurrentMonth: true,
      isToday,
      isPast: date < today,
      isAvailable: checkDateAvailability(dateStr)
    });
  }

  // Next month days
  const totalCells = Math.ceil(days.length / 7) * 7;
  const nextMonthDays = totalCells - days.length;
  for (let i = 1; i <= nextMonthDays; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date: formatDate(date),
      day: i,
      isCurrentMonth: false,
      isToday: false,
      isPast: false,
      isAvailable: false
    });
  }

  return days;
});

const currentMonth = computed(() => {
  return currentDate.value.toLocaleString('default', { month: 'long', year: 'numeric' });
});

const bookableDatesInMonth = computed(() =>
  calendarDays.value.filter(day => day.isCurrentMonth && day.isAvailable && !day.isPast).length
);

// Lifecycle hooks
onMounted(async () => {
  loading.value = true;

  try {
    // Load all required data
    await Promise.all([
      loadExams(),
      loadUserAppointments(),
      loadUserExamResults()
    ]);

    if (isReschedule.value && appointmentId.value) {
      await loadExistingAppointment();
    } else {
      const examId = route.query.examId as string;
      if (examId) {
        await loadSelectedExam(examId);
      }
    }
  } catch (err) {
    error.value = 'Failed to load data';
  } finally {
    loading.value = false;
  }
});

// Data loading methods
async function loadExams() {
  try {
    availableExams.value = await examService.getExams();
  } catch (err: any) {
    error.value = err.message || 'Failed to load exams';
  }
}

async function loadUserAppointments() {
  if (!userId.value) return;

  try {
    userAppointments.value = await examService.getExamAppointments(userId.value);
  } catch (err) {
    // ignore
  }
}

async function loadUserExamResults() {
  if (!userId.value) return;

  try {
    userExamResults.value = await examService.getUserExamResults(userId.value);
  } catch (err) {
    // ignore
  }
}

async function loadSelectedExam(examId: string) {
  try {
    const exam = await examService.getExam(examId);
    selectedExam.value = exam;
  } catch (err) {
    // ignore
  }
}

async function loadExistingAppointment() {
  try {
    existingAppointment.value = await examService.getAppointmentById(appointmentId.value);

    if (existingAppointment.value) {
      // Load the exam
      selectedExam.value = await examService.getExam(existingAppointment.value.exam);

      // Load the proctor if exists.
      //
      // A proctor that has since been removed answers 404 here, and this used
      // to swallow it: `selectedProctor` stayed null, `loadProctorAvailability`
      // returned on its first line without making a request, and the Date &
      // Time step sat there with a calendar nobody could get slots out of and
      // nothing on screen saying why. A live appointment on this platform points
      // at exactly such a proctor. Say so, and let them pick another.
      if (existingAppointment.value.proctor_id) {
        try {
          selectedProctor.value = await proctorService.getProctor(existingAppointment.value.proctor_id);
        } catch (err) {
          originalProctorMissing.value = true;
        }
      } else {
        originalProctorMissing.value = true;
      }

      // For rescheduling, start at step 1 (show current appointment)
      currentStep.value = 1;
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load appointment details';
  }
}

async function loadProctors() {
  loading.value = true;
  error.value = null;

  try {
    proctors.value = await proctorService.getProctors();
  } catch (err: any) {
    error.value = err.message || 'Failed to load proctors';
  } finally {
    loading.value = false;
  }
}

const monthKey = (proctorId: string, when: Date) =>
  `${proctorId}:${when.getFullYear()}-${when.getMonth()}`;

const slotsFrom = (day?: AvailableDay | null) =>
  (day?.available_hours || []).map((hour: AvailableHour) => ({
    id: hour.sync_id,
    startTime: hour.start_time.substring(0, 5),
    endTime: hour.end_time.substring(0, 5),
    is_available: hour.is_available,
    rawHour: hour,
  }));

/**
 * Fetch the visible month's real availability, once per proctor per month.
 *
 * The calendar used to mark every date from today onwards as available, because
 * `checkDateAvailability` asked nothing but "is this in the past?". The proctor
 * on record works a 30-day window, so most of the green ✓ dates — today
 * included, and every day of every later month — had nothing behind them, and
 * the only way to find out was to click one and read "no available time slots".
 * That is the whole of "the dates are all there and I cannot book any of them".
 */
async function loadMonthAvailability() {
  const proctor = selectedProctor.value;
  if (!proctor) return;

  const key = monthKey(proctor.external_id, currentDate.value);
  if (loadedMonths.value.includes(key)) return;

  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const from = formatDate(new Date(year, month, 1));
  const to = formatDate(new Date(year, month + 1, 0));

  availabilityLoading.value = true;
  availabilityError.value = null;
  try {
    const days = await proctorService.getProctorAvailability(proctor.external_id, from, to);
    const merged = { ...availabilityByDate.value };
    days.forEach(day => { merged[String(day.day).substring(0, 10)] = day; });
    availabilityByDate.value = merged;
    loadedMonths.value = [...loadedMonths.value, key];
  } catch (err: any) {
    // Not `error`: that swaps the whole step out for a full-page error, and a
    // month that failed to load is recoverable by paging or retrying.
    availabilityError.value = err.message || 'Could not load this proctor\'s availability.';
  } finally {
    availabilityLoading.value = false;
  }
}

/**
 * Re-read the selected date so a slot somebody else booked in the last minute
 * disappears before this student picks it.
 *
 * Deliberately on its own flag rather than the page-level `loading`, which is a
 * `v-if` over the entire step — using it here tore the calendar down and rebuilt
 * it on every single date click.
 */
async function refreshSlotsForSelectedDate() {
  const proctor = selectedProctor.value;
  const date = selectedDate.value;
  if (!proctor || !date) return;

  slotsLoading.value = true;
  try {
    const day = await proctorService.getProctorAvailabilityForDate(proctor.external_id, date);
    if (selectedDate.value !== date) return; // the reader moved on while we waited
    if (day) {
      availabilityByDate.value = { ...availabilityByDate.value, [date]: day };
    } else {
      const without = { ...availabilityByDate.value };
      delete without[date];
      availabilityByDate.value = without;
    }
    availableTimeSlots.value = slotsFrom(day);
    if (selectedTimeSlot.value &&
        !availableTimeSlots.value.some(slot => slot.id === selectedTimeSlot.value.id)) {
      selectedTimeSlot.value = null;
    }
  } catch {
    // Keep whatever the month load gave us rather than blanking the panel.
  } finally {
    if (selectedDate.value === date) slotsLoading.value = false;
  }
}

// Helper methods
/** Does the proctor actually have a bookable slot on this date? */
function checkDateAvailability(date: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parseDate(date) < today) return false;

  const day = availabilityByDate.value[date];
  return !!day && day.is_available !== false && (day.available_hours?.length || 0) > 0;
}

function getScheduledDate(exam: Exam): string {
  const appointment = userAppointments.value.find(app =>
    app.exam === exam.external_id
  );

  if (appointment) {
    const date = parseDate(appointment.appointment_date);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return '';
}

// Selection methods
function selectExam(exam: Exam) {
  if (!canScheduleExam(exam)) {
    if (hasExamPassed(exam)) {
      error.value = 'You have already passed this exam. Cannot schedule again.';
    } else if (hasActiveAppointment(exam)) {
      error.value = 'This exam is already scheduled. Please reschedule instead.';
    }
    return;
  }
  selectedExam.value = exam;
  error.value = null;
}

function selectProctor(proctor: ExamProctor) {
  selectedProctor.value = proctor;
  // Reset date/time selection when proctor changes — and the availability with
  // it, or the calendar would keep painting the previous proctor's working days.
  selectedDate.value = null;
  selectedTimeSlot.value = null;
  availableTimeSlots.value = [];
  availabilityByDate.value = {};
  loadedMonths.value = [];
  availabilityError.value = null;
}

function selectDate(day: any) {
  if (!day.isAvailable || day.isPast) return;
  // Was `!isReschedule || !hasActiveAppointmentOnDate(...)`, which short-circuits
  // true for a NEW booking — so a date the calendar had greyed out as already
  // taken was still selectable. The guard belongs on the new-booking side.
  if (!isReschedule.value && hasActiveAppointmentOnDate(day.date)) return;

  selectedDate.value = day.date;
  selectedTimeSlot.value = null;
  // Paint from the month we already fetched, then confirm against the service.
  availableTimeSlots.value = slotsFrom(availabilityByDate.value[day.date]);
  refreshSlotsForSelectedDate();
}

/** Reschedule with a proctor who has since been removed — see the template.
 *  `selectProctor` clears the old availability; the watcher refetches it. */
function chooseProctorForReschedule(proctor: ExamProctor) {
  selectProctor(proctor);
  originalProctorMissing.value = false;
}

function selectTimeSlot(slot: any) {
  if (slot.is_available) {
    selectedTimeSlot.value = slot;
  }
}

// Navigation methods
function nextStep() {
  if (currentStep.value === 1 && !isReschedule.value) {
    if (selectedExam.value && !canScheduleExam(selectedExam.value)) {
      if (hasExamPassed(selectedExam.value)) {
        error.value = 'You have already passed this exam. Cannot schedule again.';
      } else if (hasActiveAppointment(selectedExam.value)) {
        error.value = 'This exam is already scheduled. Please reschedule instead.';
      }
      return;
    }
    loadProctors();
  } else if (currentStep.value === 2 && !isReschedule.value) {
    selectedDate.value = null;
    selectedTimeSlot.value = null;
    availableTimeSlots.value = [];
  } else if (isReschedule.value && currentStep.value === 1) {
    // For rescheduling, we need to load proctors if not already loaded
    if (!selectedProctor.value) {
      loadProctors();
    }
  }

  error.value = null;
  currentStep.value++;
  // Arriving on the date step loads that month's availability — see the watcher
  // next to prevMonth/nextMonth, which is the single place that fetches it.
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

function retryCurrentStep() {
  error.value = null;

  if (isDateStep.value) {
    retryAvailability();
  } else if (!isReschedule.value) {
    if (currentStep.value === 1) {
      loadExams();
    } else if (currentStep.value === 2) {
      loadProctors();
    }
  } else if (currentStep.value === 1) {
    loadExistingAppointment();
  }
}

function retryAvailability() {
  availabilityError.value = null;
  loadedMonths.value = [];
  loadMonthAvailability();
  if (selectedDate.value) refreshSlotsForSelectedDate();
}

// Booking methods
async function confirmBooking() {
  if (!selectedExam.value || !selectedProctor.value || !selectedDate.value || !selectedTimeSlot.value) {
    error.value = 'Please complete all booking details';
    return;
  }

  if (!userId.value || !username.value) {
    error.value = 'User information is missing';
    return;
  }

  // Check if exam can be scheduled
  if (!isReschedule.value && !canScheduleExam(selectedExam.value)) {
    if (hasExamPassed(selectedExam.value)) {
      error.value = 'You have already passed this exam. Cannot schedule again.';
    } else if (hasActiveAppointment(selectedExam.value)) {
      error.value = 'This exam is already scheduled. Please reschedule instead.';
    }
    return;
  }

  // Check if appointment on same date (for new bookings)
  if (!isReschedule.value && hasActiveAppointmentOnSelectedDate.value) {
    error.value = 'You already have an appointment for this exam on the selected date.';
    return;
  }

  bookingInProgress.value = true;
  error.value = null;
  slotReserveWarning.value = null;

  try {
    const appointmentDateTime = new Date(`${selectedDate.value}T${selectedTimeSlot.value.startTime}:00`);

    if (isReschedule.value && existingAppointment.value) {
      // RESCHEDULE: Create new appointment and cancel old one
      await handleReschedule(appointmentDateTime);
    } else {
      // NEW BOOKING: Create new appointment
      await handleNewBooking(appointmentDateTime);
    }

    bookingInProgress.value = false;
    showSuccessModal.value = true;
  } catch (err: any) {
    error.value = err.message || `Failed to ${isReschedule.value ? 'reschedule' : 'schedule'} exam`;
    bookingInProgress.value = false;
  }
}

async function handleReschedule(appointmentDateTime: Date) {
  if (!existingAppointment.value) return;

  // 1. Mark new time slot as unavailable
  await proctorService.updateAvailability({
    hour_sync_id: selectedTimeSlot.value.id,
    is_available: false
  });

  // 2. Create new appointment
  const newAppointmentData = {
    external_id: `exam_appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId.value,
    username: username.value,
    exam: selectedExam.value?.external_id, // This should be the exam's external_id string
    proctor_id: selectedProctor.value?.external_id,
    appointment_date: appointmentDateTime.toISOString(),
    created_at: new Date().toISOString(),
    can_start: false,
    is_entered: false,
    appointment_status: 'Scheduled',
    proctor_external_id: selectedProctor.value?.external_id
  };

  const newAppointment = await examService.createExamAppointment(newAppointmentData);

  // The student's own copy of the new time. `exam.service.ts` tells the *proctor*
  // inside createExamAppointment; this is the other half.
  notificationService.notify('exam.appointment_rescheduled', {
    to: username.value || '',
    params: {
      exam: selectedExam.value?.title || 'your exam',
      when: appointmentDateTime.toLocaleString(),
      // The NEW appointment's id. Rescheduling creates a new record and cancels
      // the old one, so the old id would open a cancelled appointment.
      appointmentId: newAppointment?.external_id || newAppointmentData.external_id,
    },
  });

  bookedAppointment.value = newAppointment || null;

  // 3. Cancel the old appointment
  try {
    await examService.cancelExamAppointment(existingAppointment.value.external_id);

    // 4. Free up the old time slot
    if (existingAppointment.value.proctor_id) {
      const oldAppointmentDate = new Date(existingAppointment.value.appointment_date);
      const oldDateStr = formatDate(oldAppointmentDate);
      const oldTimeStr = oldAppointmentDate.toTimeString().substring(0, 5);

      try {
        // The RAW day, taken slots included. `getProctorAvailabilityForDate`
        // returns only bookable hours, and the hour being released is the one
        // marked unavailable — so the find below never matched and the old slot
        // stayed closed forever, quietly eating the proctor's calendar.
        const oldAvailability = await proctorService.getProctorDayRaw(
          existingAppointment.value.proctor_id,
          oldDateStr
        );

        if (oldAvailability && oldAvailability.available_hours) {
          const oldHour = oldAvailability.available_hours.find(
            hour => hour.start_time.substring(0, 5) === oldTimeStr
          );

          if (oldHour) {
            await proctorService.updateAvailability({
              hour_sync_id: oldHour.sync_id,
              is_available: true
            });
          }
        }
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    // Continue even if we can't cancel the old appointment
  }
}

async function handleNewBooking(appointmentDateTime: Date) {
  // Create the appointment FIRST, then close the slot.
  //
  // The other order closed the slot before the booking existed, so anything that
  // failed in between — a cold replica, a validation error, a dropped
  // connection — left the hour marked unavailable with no appointment against
  // it. Nothing on the platform ever reopens such a slot: it is not on any
  // appointment, so no cancel can release it, and the student is told the
  // booking failed while the proctor quietly loses that hour for good. A handful
  // of retries eats a proctor's whole week.
  //
  // Booked first, the failure modes swap places for the better: the worst case
  // is now a real appointment whose slot is still shown as open, which is
  // recoverable — the reserve step below is retried, and a double booking is
  // visible to the proctor and to the student rather than being an hour that
  // silently ceased to exist.
  const appointmentData = {
    external_id: `exam_appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    user_id: userId.value,
    username: username.value,
    exam: selectedExam.value?.external_id, // This MUST be the exam's external_id string
    proctor_id: selectedProctor.value?.external_id,
    appointment_date: appointmentDateTime.toISOString(),
    created_at: new Date().toISOString(),
    can_start: false,
    is_entered: false,
    appointment_status: 'Scheduled',
    proctor_external_id: selectedProctor.value?.external_id
  };

  const created = await examService.createExamAppointment(appointmentData);

  // Now reserve the hour. A failure here is reported rather than swallowed: the
  // appointment stands, and leaving the slot open would let a second student
  // book the same hour with nothing on either screen saying so.
  try {
    await proctorService.updateAvailability({
      hour_sync_id: selectedTimeSlot.value.id,
      is_available: false
    });
  } catch (err) {
    slotReserveWarning.value =
      'Your appointment is booked, but the time slot could not be marked as taken. '
      + 'Please tell your proctor so nobody else is given the same hour.';
  }

  // The PROCTOR is told by `exam.service.ts`, from inside `createExamAppointment`,
  // and that is the only notification a booking sends anybody but the student.
  //
  // There used to be a `notifyAdmins('exam.appointment_requested')` here as well,
  // saying the appointment "needs approving before they can start" and linking to
  // `/exam-approval`. All three parts of that were wrong: booking needs no
  // approval (what remains is the proctor opening the room on the day, which is
  // `can_start` and has its own notification); the link carried no
  // `appointmentId`, so it led to a page that cannot render; and `/exam-approval`
  // is the student's own view of their appointment, not a proctor's screen. Since
  // the proctor on this platform is also an admin they received it too - two bells
  // for one booking, and the wrong one led to a dead end.

  // The student's own durable copy. The confirmation modal is gone the moment they
  // close the tab, and an exam appointment is a thing somebody comes back looking
  // for - "when is my exam, and who is invigilating?" - which is exactly what the
  // bell is for. The link carries the id, because that page is one appointment's
  // page and cannot render without one.
  notificationService.notify('exam.appointment_booked', {
    to: username.value || '',
    params: {
      exam: selectedExam.value?.title || 'your exam',
      when: appointmentDateTime.toLocaleString(),
      proctor: selectedProctor.value?.username || 'your proctor',
      appointmentId: created?.external_id || appointmentData.external_id,
    },
  });

  // Remember what was just created, so the success modal can link to it. Without
  // this, `goToAppointment()` had nothing to name - `existingAppointment` is only
  // set when RESCHEDULING - and fell through to /exams, which is why booking never
  // led anywhere near the appointment page.
  bookedAppointment.value = created || null;
}

// Cancel appointment methods
function cancelAppointment() {
  showCancelModal.value = true;
}

async function confirmCancel() {
  if (!existingAppointment.value) return;

  cancelling.value = true;

  try {
    // 1. Cancel the appointment
    await examService.cancelExamAppointment(existingAppointment.value.external_id);

    // 2. Free up the time slot
    if (existingAppointment.value.proctor_id) {
      const oldAppointmentDate = new Date(existingAppointment.value.appointment_date);
      const oldDateStr = formatDate(oldAppointmentDate);
      const oldTimeStr = oldAppointmentDate.toTimeString().substring(0, 5);

      try {
        // The RAW day, taken slots included. `getProctorAvailabilityForDate`
        // returns only bookable hours, and the hour being released is the one
        // marked unavailable — so the find below never matched and the old slot
        // stayed closed forever, quietly eating the proctor's calendar.
        const oldAvailability = await proctorService.getProctorDayRaw(
          existingAppointment.value.proctor_id,
          oldDateStr
        );

        if (oldAvailability && oldAvailability.available_hours) {
          const oldHour = oldAvailability.available_hours.find(
            hour => hour.start_time.substring(0, 5) === oldTimeStr
          );

          if (oldHour) {
            await proctorService.updateAvailability({
              hour_sync_id: oldHour.sync_id,
              is_available: true
            });
          }
        }
      } catch (err) {
        // ignore
      }
    }

    // The student's own copy. `exam.service.ts` tells the proctor from inside
    // cancelExamAppointment; without this the person who cancelled has nothing
    // in writing, which matters most when they cancelled by accident.
    notificationService.notify('exam.appointment_cancelled', {
      to: username.value || '',
      params: {
        exam: selectedExam.value?.title || existingAppointment.value?.exam_title || 'your exam',
        when: formatAppointmentDateTimeOf(existingAppointment.value?.appointment_date),
      },
    });

    showCancelModal.value = false;

    // Show success message and redirect
    setTimeout(() => {
      router.push('/exams');
    }, 1500);
  } catch (err: any) {
    error.value = err.message || 'Failed to cancel appointment';
  } finally {
    cancelling.value = false;
  }
}

// Formatting methods
function formatAppointmentDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  const d = parseDate(dateString);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAppointmentTime(dateString?: string): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/** An existing appointment's stored timestamp, as a sentence. */
function formatAppointmentDateTimeOf(dateString?: string): string {
  if (!dateString) return 'its scheduled time';
  const date = parseDate(dateString);
  if (isNaN(date.getTime())) return 'its scheduled time';
  return date.toLocaleString();
}

function formatAppointmentDateTime(): string {
  if (!selectedDate.value || !selectedTimeSlot.value) return 'N/A';

  const date = parseDate(selectedDate.value);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ` at ${selectedTimeSlot.value.startTime}`;
}

// Calendar navigation. The watcher below fetches the month that scrolls into
// view — without it, paging to September shows a calendar of grey days whether
// or not the proctor works then.
function prevMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1);
}

function nextMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1);
}

watch([currentDate, selectedProctor, isDateStep], () => {
  if (isDateStep.value && selectedProctor.value) loadMonthAvailability();
});

// Navigation methods
function cancelSchedule() {
  if (isReschedule.value && existingAppointment.value) {
    router.push(`/exam-approval?appointmentId=${existingAppointment.value.external_id}`);
  } else {
    router.push('/exams');
  }
}

function closeSuccessModal() {
  showSuccessModal.value = false;
  if (isReschedule.value && existingAppointment.value) {
    router.push(`/exam-approval?appointmentId=${existingAppointment.value.external_id}`);
  } else {
    router.push('/exams');
  }
}

function goToExams() {
  router.push('/exams');
}

/**
 * Open the appointment this visit produced.
 *
 * `bookedAppointment` first: on a reschedule it is the NEW record and the old one
 * has just been cancelled, so opening `existingAppointment` would show a cancelled
 * appointment. On a new booking it is the only id there is, and before it was kept
 * this fell through to /exams - which is why booking never led to this page.
 *
 * The id is not optional. `/exam-approval` is a single appointment's page and
 * answers "No appointment specified" without one, so there is deliberately no
 * bare-path fallback: with no id, /exams is the honest destination.
 */
function goToAppointment() {
  const appointment = bookedAppointment.value || existingAppointment.value;
  if (appointment?.external_id) {
    router.push({
      path: '/exam-approval',
      query: { appointmentId: appointment.external_id },
    });
  } else {
    router.push('/exams');
  }
}
</script>
