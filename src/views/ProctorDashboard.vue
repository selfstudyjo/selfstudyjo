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

            <!-- Appointments List with Filters -->
            <div v-else>
                <!-- Filters Section -->
                <div class="filters-section">
                    <div class="filters-header">
                        <h2>Upcoming Exam Appointments</h2>
                        <div class="stats">
                            <span class="stat-item">
                                <span class="stat-label">Total:</span>
                                <span class="stat-value">{{ filteredAppointments.length }}</span>
                            </span>
                            <span class="stat-item">
                                <span class="stat-label">Scheduled:</span>
                                <span class="stat-value">{{ scheduledCount }}</span>
                            </span>
                        </div>
                    </div>

                    <div class="filters-grid">
                        <div class="filter-group">
                            <label for="searchUsername">Username</label>
                            <input
                                id="searchUsername"
                                v-model="filters.username"
                                type="text"
                                placeholder="Filter by username"
                                class="filter-input"
                            />
                        </div>

                        <div class="filter-group">
                            <label for="searchExamTitle">Exam Title</label>
                            <input
                                id="searchExamTitle"
                                v-model="filters.examTitle"
                                type="text"
                                placeholder="Filter by exam title"
                                class="filter-input"
                            />
                        </div>

                        <div class="filter-group">
                            <label for="statusFilter">Status</label>
                            <select id="statusFilter" v-model="filters.status" class="filter-input">
                                <option value="">All Statuses</option>
                                <option value="Scheduled">Scheduled</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Expired">Expired</option>
                                <option value="No Reservation Yet">No Reservation Yet</option>
                            </select>
                        </div>

                        <div class="filter-group">
                            <label for="dateFrom">From Date</label>
                            <input
                                id="dateFrom"
                                v-model="filters.dateFrom"
                                type="date"
                                class="filter-input"
                            />
                        </div>

                        <div class="filter-group">
                            <label for="dateTo">To Date</label>
                            <input
                                id="dateTo"
                                v-model="filters.dateTo"
                                type="date"
                                class="filter-input"
                            />
                        </div>

                        <div class="filter-actions">
                            <button @click="clearFilters" class="clear-filters-btn">
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Appointments Grid -->
                <div class="appointments-list">
                    <div
                        v-for="appointment in filteredAppointments"
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
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { examService, type ExamAppointment } from '@/services/exam.service';

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

/* Additional styles for filters */
.filters-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: rgba(15, 15, 40, 0.85);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px) saturate(180%);
}

.filters-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
}

.filters-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 0 10px rgba(0,0,0,0.8);
    margin: 0;
}

.filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    align-items: end;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.filter-group label {
    font-size: 0.875rem;
    color: #e0e0e0;
    text-shadow: 0 0 10px rgba(0,0,0,0.8);
}

.filter-input {
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.9rem;
    transition: all 0.3s ease;
}

.filter-input:focus {
    outline: none;
    border-color: #4ECDC4;
    box-shadow: 0 0 15px rgba(78, 205, 196, 0.3);
}

.filter-actions {
    display: flex;
    align-items: flex-end;
}

.clear-filters-btn {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, rgba(255, 107, 107, 0.9), rgba(255, 86, 86, 0.9));
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-shadow: 0 0 10px rgba(0,0,0,0.8);
    white-space: nowrap;
}

.clear-filters-btn:hover {
    background: linear-gradient(135deg, rgba(255, 86, 86, 1), rgba(255, 70, 70, 1));
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .filters-grid {
        grid-template-columns: 1fr;
    }
    .filter-actions {
        justify-content: flex-end;
    }
}
</style>