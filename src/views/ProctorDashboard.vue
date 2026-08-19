<template>
    <div class="proctor-dashboard">
        <div class="pd-header">
            <h1>Proctor Dashboard</h1>
            <p v-if="proctorData" class="pd-whoami">
                Welcome, {{ proctorData.username }} ({{ proctorData.email }})
            </p>
        </div>

        <div class="pd-content">
            <!-- Loading State -->
            <div v-if="loading" class="pd-loading">
                <div class="pd-spinner"></div>
                <p>Loading appointments...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="pd-error">
                <div class="pd-error__icon">❌</div>
                <p>{{ error }}</p>
                <button @click="loadAppointments" class="pd-btn pd-btn--primary">
                    Try Again
                </button>
            </div>

            <!-- Empty State -->
            <div v-else-if="appointments.length === 0" class="pd-empty">
                <div class="pd-empty__icon">📅</div>
                <h3>No Appointments Yet</h3>
                <p>You don't have any exam appointments assigned to you.</p>
            </div>

            <!-- Appointments List with Filters -->
            <div v-else>
                <!-- Stat tiles. Four numbers a proctor is actually asked for,
                     and "needs attention" is first because it is the only one
                     that means somebody is waiting on them right now. -->
                <div class="pd-stats">
                    <div class="pd-stat" :class="{ 'pd-stat--urgent': needsAttention.length > 0 }">
                        <div class="pd-stat__value">{{ needsAttention.length }}</div>
                        <div class="pd-stat__label">Needs attention</div>
                    </div>
                    <div class="pd-stat">
                        <div class="pd-stat__value">{{ todays.length }}</div>
                        <div class="pd-stat__label">Today</div>
                    </div>
                    <div class="pd-stat">
                        <div class="pd-stat__value">{{ upcoming.length }}</div>
                        <div class="pd-stat__label">Upcoming</div>
                    </div>
                    <div class="pd-stat">
                        <div class="pd-stat__value">{{ completedCount }}</div>
                        <div class="pd-stat__label">Completed</div>
                    </div>
                </div>

                <!-- Filters Section -->
                <div class="pd-filters">
                    <div class="pd-filters__head">
                        <h2>Exam appointments</h2>
                        <div class="pd-tally">
                            <span class="pd-tally__item">
                                <span class="pd-tally__label">Showing:</span>
                                <span class="pd-tally__value">{{ filteredAppointments.length }}</span>
                            </span>
                            <span class="pd-tally__item">
                                <span class="pd-tally__label">Live:</span>
                                <span class="pd-tally__value">{{ scheduledCount }}</span>
                            </span>
                        </div>
                    </div>

                    <div class="pd-filters__grid">
                        <div class="pd-field">
                            <label for="searchUsername">Username</label>
                            <input
                                id="searchUsername"
                                v-model="filters.username"
                                type="text"
                                placeholder="Filter by username"
                                class="pd-input"
                            />
                        </div>

                        <div class="pd-field">
                            <label for="searchExamTitle">Exam Title</label>
                            <input
                                id="searchExamTitle"
                                v-model="filters.examTitle"
                                type="text"
                                placeholder="Filter by exam title"
                                class="pd-input"
                            />
                        </div>

                        <div class="pd-field">
                            <label for="statusFilter">Status</label>
                            <select id="statusFilter" v-model="filters.status" class="pd-input">
                                <option value="">All Statuses</option>
                                <option value="Scheduled">Scheduled</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Expired">Expired</option>
                                <option value="No Reservation Yet">No Reservation Yet</option>
                            </select>
                        </div>

                        <div class="pd-field">
                            <label for="dateFrom">From Date</label>
                            <input
                                id="dateFrom"
                                v-model="filters.dateFrom"
                                type="date"
                                class="pd-input"
                            />
                        </div>

                        <div class="pd-field">
                            <label for="dateTo">To Date</label>
                            <input
                                id="dateTo"
                                v-model="filters.dateTo"
                                type="date"
                                class="pd-input"
                            />
                        </div>

                        <div class="pd-filters__actions">
                            <button @click="clearFilters" class="pd-btn pd-btn--ghost">
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Appointments, grouped by what the proctor has to do about
                     them rather than by date. See `groups` in the script: the old
                     flat descending list buried today's exams under a page of
                     last month's completed ones. -->
                <div v-if="groups.length === 0" class="pd-empty">
                    <div class="pd-empty__icon">&#128269;</div>
                    <h3>Nothing matches those filters</h3>
                    <p>{{ appointments.length }} appointment{{ appointments.length === 1 ? '' : 's' }} hidden by the filters above.</p>
                    <button @click="clearFilters" class="pd-btn pd-btn--primary">Clear filters</button>
                </div>

                <section v-for="group in groups" :key="group.key"
                         class="pd-group"
                         :class="{ 'pd-group--urgent': group.key === 'attention' }">
                    <header class="pd-group__head">
                        <h2 class="pd-group__title">
                            {{ group.title }}
                            <span class="pd-group__count">{{ group.rows.length }}</span>
                        </h2>
                        <p class="pd-group__hint">{{ group.hint }}</p>
                    </header>

                    <div class="pd-cards">
                        <article
                            v-for="appointment in group.rows"
                            :key="appointment.external_id"
                            class="pd-card"
                            :class="{ 'pd-card--live': isLiveNow(appointment) }"
                            tabindex="0"
                            role="button"
                            @click="viewAppointmentDetails(appointment.external_id)"
                            @keydown.enter="viewAppointmentDetails(appointment.external_id)"
                            @keydown.space.prevent="viewAppointmentDetails(appointment.external_id)"
                        >
                            <div class="pd-card__head">
                                <div class="pd-card__title">
                                    <h3>{{ appointment.exam_title || 'Exam' }}</h3>
                                    <div class="pd-card__tags">
                                        <span v-if="isLiveNow(appointment)" class="pd-live">
                                            <span class="pd-live__dot" aria-hidden="true"></span>
                                            Live
                                        </span>
                                        <span class="pd-status" :class="getStatusClass(appointment.appointment_status)">
                                            {{ appointment.appointment_status }}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- The candidate first and largest: a proctor
                                 identifies an appointment by the person, never by
                                 the uuid that used to lead this card. -->
                            <div class="pd-who">
                                <div class="pd-who__avatar" aria-hidden="true">
                                    {{ (appointment.username || '?').charAt(0).toUpperCase() }}
                                </div>
                                <div class="pd-who__text">
                                    <div class="pd-who__name">{{ appointment.username || 'Unknown candidate' }}</div>
                                    <div class="pd-who__when">{{ relativeWhen(appointment.appointment_date) }}</div>
                                </div>
                            </div>

                            <!-- On a CLOSED appointment (completed, cancelled,
                                 expired) the start permission and the missing room
                                 link are both meaningless: there is nothing left to
                                 permit and nowhere left to sit. Shown anyway they
                                 read as the record being in the wrong state - a
                                 finished exam saying "Not yet allowed to start". -->
                            <div class="pd-flags">
                                <span v-if="!isClosed(appointment)" class="pd-flag"
                                      :class="appointment.can_start ? 'pd-flag--on' : 'pd-flag--off'">
                                    {{ appointment.can_start ? 'Allowed to start' : 'Not yet allowed to start' }}
                                </span>
                                <span v-if="appointment.is_entered" class="pd-flag pd-flag--on">Entered the room</span>
                                <span v-if="!isClosed(appointment) && !appointment.room_url_1 && !appointment.room_url_2"
                                      class="pd-flag pd-flag--warn">No room link set</span>
                            </div>

                            <div class="pd-card__actions">
                                <button
                                    class="pd-btn pd-btn--primary"
                                    @click.stop="viewAppointmentDetails(appointment.external_id)"
                                >
                                    {{ primaryActionLabel(appointment) }}
                                </button>
                                <div class="pd-rooms">
                                    <a
                                        v-if="appointment.room_url_1"
                                        :href="appointment.room_url_1"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="pd-room"
                                        @click.stop
                                    >
                                        Room 1
                                    </a>
                                    <a
                                        v-if="appointment.room_url_2"
                                        :href="appointment.room_url_2"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="pd-room"
                                        @click.stop
                                    >
                                        Room 2
                                    </a>
                                </div>
                            </div>

                            <!-- The ids stay, because support work and every other
                                 service key on them - but at the bottom, quiet, and
                                 breakable (see exam-system.css: a 36-character uuid
                                 with no break point sets the width of its card). -->
                            <details class="pd-ids" @click.stop>
                                <summary>Reference ids</summary>
                                <div class="pd-ids__row">
                                    <span class="pd-ids__label">Appointment</span>
                                    <span class="pd-ids__value pd-mono">{{ appointment.external_id }}</span>
                                </div>
                                <div class="pd-ids__row">
                                    <span class="pd-ids__label">Candidate</span>
                                    <span class="pd-ids__value pd-mono">{{ appointment.user_id }}</span>
                                </div>
                                <div class="pd-ids__row">
                                    <span class="pd-ids__label">Booked</span>
                                    <span class="pd-ids__value">{{ formatDate(appointment.created_at) }}</span>
                                </div>
                            </details>
                        </article>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, type ExamAppointment } from '@/services/exam.service';
import { groupForProctor, isClosed, isLiveNow, primaryActionLabel, relativeWhen } from '@/utils/proctorQueue';

const router = useRouter();
const authStore = useAuthStore();

const appointments = ref<ExamAppointment[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const proctorData = computed(() => authStore.proctorData);

// Filter state
const filters = reactive({
    username: '',
    examTitle: '',
    status: '',
    dateFrom: '',
    dateTo: ''
});

// Filtered appointments based on current filters
const filteredAppointments = computed(() => {
    return appointments.value.filter(app => {
        // Username filter (case-insensitive partial match)
        if (filters.username && !app.username.toLowerCase().includes(filters.username.toLowerCase())) {
            return false;
        }
        // Exam title filter (case-insensitive partial match)
        if (filters.examTitle && app.exam_title && !app.exam_title.toLowerCase().includes(filters.examTitle.toLowerCase())) {
            return false;
        }
        // Status filter
        if (filters.status && app.appointment_status !== filters.status) {
            return false;
        }
        // Date from filter
        if (filters.dateFrom) {
            const appDate = new Date(app.appointment_date).toISOString().split('T')[0];
            if (appDate < filters.dateFrom) {
                return false;
            }
        }
        // Date to filter
        if (filters.dateTo) {
            const appDate = new Date(app.appointment_date).toISOString().split('T')[0];
            if (appDate > filters.dateTo) {
                return false;
            }
        }
        return true;
    });
});

const scheduledCount = computed(() => {
    return filteredAppointments.value.filter(app =>
        app.appointment_status === 'Scheduled' ||
        app.appointment_status === 'In Progress'
    ).length;
});

/* ---------------------------------------------------------------------------
 * Grouping lives in utils/proctorQueue.ts - a plain module, so the whole
 * ordering model is verifiable in node (`npm run check:proctorqueue`) and the
 * check cannot drift from the screen. Same precedent as appNav.ts and
 * drawEngine.ts. What stays here is only the wiring.
 * ------------------------------------------------------------------------- */

const groups = computed(() => groupForProctor(filteredAppointments.value));

const rowsIn = (key: string) =>
    groups.value.find(group => group.key === key)?.rows ?? [];

const needsAttention = computed(() => rowsIn('attention'));
const todays = computed(() => rowsIn('today'));
const upcoming = computed(() => rowsIn('upcoming'));

const completedCount = computed(() => filteredAppointments.value.filter(
    app => app.appointment_status === 'Completed').length);

const loadAppointments = async () => {
    if (!proctorData.value?.external_id) {
        error.value = 'Proctor data not available';
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const allAppointments = await examService.getExamAppointmentsByProctor(proctorData.value.external_id);
        // Already sorted by appointment_date descending in service, but ensure it
        appointments.value = allAppointments.sort((a, b) =>
            new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
        );
    } catch (err: any) {
        error.value = err.message || 'Failed to load appointments';
    } finally {
        loading.value = false;
    }
};

const clearFilters = () => {
    filters.username = '';
    filters.examTitle = '';
    filters.status = '';
    filters.dateFrom = '';
    filters.dateTo = '';
};

const viewAppointmentDetails = (appointmentId: string) => {
    router.push(`/proctor-appointment/${appointmentId}`);
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getStatusClass = (status: string): string => {
    // `pd-` prefixed like every other class on this page: `exams.css` defines a
    // global `.status-scheduled` and friends, and whichever file loads last would
    // otherwise decide what a status pill looks like here.
    const statusMap: Record<string, string> = {
        'Scheduled': 'pd-status--scheduled',
        'In Progress': 'pd-status--live',
        'Completed': 'pd-status--done',
        'Cancelled': 'pd-status--cancelled',
        'Expired': 'pd-status--expired',
        'No Reservation Yet': 'pd-status--pending'
    };
    return statusMap[status] || 'pd-status--default';
};

onMounted(() => {
    if (authStore.isProctor && proctorData.value) {
        loadAppointments();
    } else {
        error.value = 'You are not authorized as a proctor';
    }
});

// This page's whole appearance, in one file. Loaded GLOBALLY rather than through
// an `@import` nested in a scoped style block: Vite inlines such an import and
// then applies the scope attribute to it, so every rule gained a `[data-v-...]`
// and therefore a class's worth of specificity over the shared layers that are
// meant to sit on top of it. Every selector in there is anchored on
// `.proctor-dashboard` by hand instead, so it needs neither.
import '@/assets/css/proctor-dashboard.css';
// Structural + responsive fixes shared by the eight exam-system pages, imported
// second so its additive rules land after the page's own.
import '@/assets/css/exam-system.css';
</script>
