<template>
    <div class="proctor-dashboard">
        <div class="dashboard-header">
            <h1>Proctor Dashboard</h1>
            <p v-if="proctorData" class="proctor-info">
                Welcome, {{ proctorData.username }} ({{ proctorData.email }})
            </p>
        </div>

        <div class="dashboard-content">
            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading appointments...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-state">
                <div class="error-icon">❌</div>
                <p>{{ error }}</p>
                <button @click="loadAppointments" class="retry-btn">
                    Try Again
                </button>
            </div>

            <!-- Empty State -->
            <div v-else-if="appointments.length === 0" class="empty-state">
                <div class="empty-icon">📅</div>
                <h3>No Appointments Yet</h3>
                <p>You don't have any exam appointments assigned to you.</p>
            </div>

            <!-- Appointments List -->
            <div v-else class="appointments-grid">
                <div class="appointments-header">
                    <h2>Upcoming Exam Appointments</h2>
                    <div class="stats">
                        <span class="stat-item">
                            <span class="stat-label">Total:</span>
                            <span class="stat-value">{{ appointments.length }}</span>
                        </span>
                        <span class="stat-item">
                            <span class="stat-label">Scheduled:</span>
                            <span class="stat-value">{{ scheduledCount }}</span>
                        </span>
                    </div>
                </div>

                <div class="appointments-list">
                    <div
                        v-for="appointment in appointments"
                        :key="appointment.external_id"
                        class="appointment-card"
                        @click="viewAppointmentDetails(appointment.external_id)"
                    >
                        <div class="appointment-header">
                            <div class="appointment-title">
                                <h3>{{ appointment.exam_title || 'Exam' }}</h3>
                                <span class="status-badge" :class="getStatusClass(appointment.appointment_status)">
                                    {{ appointment.appointment_status }}
                                </span>
                            </div>
                            <div class="appointment-meta">
                                <span class="meta-item">
                                    <span class="meta-icon">👤</span>
                                    {{ appointment.username }}
                                </span>
                                <span class="meta-item">
                                    <span class="meta-icon">📅</span>
                                    {{ formatDate(appointment.appointment_date) }}
                                </span>
                            </div>
                        </div>

                        <div class="appointment-details">
                            <div class="detail-row">
                                <span class="detail-label">User ID:</span>
                                <span class="detail-value">{{ appointment.user_id }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Appointment ID:</span>
                                <span class="detail-value code">{{ appointment.external_id }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Created:</span>
                                <span class="detail-value">{{ formatDate(appointment.created_at) }}</span>
                            </div>
                        </div>

                        <div class="appointment-actions">
                            <button
                                class="view-btn"
                                @click.stop="viewAppointmentDetails(appointment.external_id)"
                            >
                                View Details
                            </button>
                            <div class="room-links">
                                <a
                                    v-if="appointment.room_url_1"
                                    :href="appointment.room_url_1"
                                    target="_blank"
                                    class="room-link"
                                    @click.stop
                                >
                                    Room 1
                                </a>
                                <a
                                    v-if="appointment.room_url_2"
                                    :href="appointment.room_url_2"
                                    target="_blank"
                                    class="room-link"
                                    @click.stop
                                >
                                    Room 2
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, type ExamAppointment } from '@/services/exam.service';

const router = useRouter();
const authStore = useAuthStore();

const appointments = ref<ExamAppointment[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const proctorData = computed(() => authStore.proctorData);

const scheduledCount = computed(() => {
    return appointments.value.filter(app =>
        app.appointment_status === 'Scheduled' ||
        app.appointment_status === 'In Progress'
    ).length;
});

const loadAppointments = async () => {
    if (!proctorData.value?.external_id) {
        error.value = 'Proctor data not available';
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        appointments.value = await examService.getExamAppointmentsByProctor(proctorData.value.external_id);
    } catch (err: any) {
        error.value = err.message || 'Failed to load appointments';
    } finally {
        loading.value = false;
    }
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
    const statusMap: Record<string, string> = {
        'Scheduled': 'status-scheduled',
        'In Progress': 'status-in-progress',
        'Completed': 'status-completed',
        'Cancelled': 'status-cancelled',
        'Expired': 'status-expired',
        'No Reservation Yet': 'status-pending'
    };
    return statusMap[status] || 'status-default';
};

onMounted(() => {
    if (authStore.isProctor && proctorData.value) {
        loadAppointments();
    } else {
        error.value = 'You are not authorized as a proctor';
    }
});
</script>

<style scoped>
@import '@/assets/css/proctor-dashboard.css';
</style>
