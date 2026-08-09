<template>
    <div class="proctor-appointment">
        <div class="appointment-header">
            <button class="back-btn" @click="goBack">
                ← Back to Dashboard
            </button>
            <h1>Exam Appointment Details</h1>
        </div>

        <div class="appointment-content">
            <!-- Loading State -->
            <div v-if="loading" class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading appointment details...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="error-state">
                <div class="error-icon">❌</div>
                <p>{{ error }}</p>
                <button @click="loadAppointmentDetails" class="retry-btn">
                    Try Again
                </button>
            </div>

            <!-- Appointment Details -->
            <div v-else-if="appointment" class="appointment-details">
                <div class="details-grid">
                    <!-- Left Column: Appointment Info -->
                    <div class="details-column">
                        <div class="details-section">
                            <h2>Appointment Information</h2>
                            <div class="info-card">
                                <div class="info-row">
                                    <span class="info-label">Status:</span>
                                    <span class="info-value">
                                        <span class="status-badge" :class="getStatusClass(appointment.appointment_status)">
                                            {{ appointment.appointment_status }}
                                        </span>
                                    </span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Appointment ID:</span>
                                    <span class="info-value code">{{ appointment.external_id }}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Exam:</span>
                                    <span class="info-value">{{ appointment.exam_title || appointment.exam }}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Appointment Date:</span>
                                    <span class="info-value">{{ formatDateTime(appointment.appointment_date) }}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Created:</span>
                                    <span class="info-value">{{ formatDateTime(appointment.created_at) }}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">Proctor ID:</span>
                                    <span class="info-value">{{ appointment.proctor_id || 'Not assigned' }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Exam Rooms - UPDATED FOR EDITING -->
                        <div class="details-section">
                            <div class="section-header">
                                <h2>Exam Rooms</h2>
                                <button
                                    v-if="isEditingRooms"
                                    class="save-rooms-btn"
                                    @click="saveRoomUrls"
                                    :disabled="savingRooms"
                                >
                                    <span v-if="savingRooms">Saving...</span>
                                    <span v-else>Save Rooms</span>
                                </button>
                                <button
                                    v-else
                                    class="edit-rooms-btn"
                                    @click="startEditingRooms"
                                >
                                    Edit Rooms
                                </button>
                            </div>

                            <div class="rooms-grid">
                                <!-- Room 1 -->
                                <div class="room-card">
                                    <div class="room-header">
                                        <span class="room-icon">🔗</span>
                                        <h3>Room 1</h3>
                                        <span v-if="appointment.room_url_1" class="room-status">Active</span>
                                        <span v-else class="room-status inactive">Not Set</span>
                                    </div>

                                    <div v-if="isEditingRooms" class="room-edit">
                                        <div class="input-group">
                                            <label for="room1">Room 1 URL:</label>
                                            <input
                                                type="url"
                                                id="room1"
                                                v-model="roomUrl1"
                                                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                                class="url-input"
                                            />
                                            <div class="input-help">
                                                Enter the video conference URL (Zoom, Google Meet, etc.)
                                            </div>
                                        </div>
                                        <div class="room-actions">
                                            <button
                                                v-if="appointment.room_url_1"
                                                class="clear-btn"
                                                @click="clearRoomUrl(1)"
                                                :disabled="savingRooms"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                class="test-btn"
                                                @click="testRoomUrl(roomUrl1, 1)"
                                                :disabled="!roomUrl1 || savingRooms"
                                            >
                                                Test Link
                                            </button>
                                        </div>
                                    </div>
                                    <div v-else class="room-view">
                                        <a
                                            v-if="appointment.room_url_1"
                                            :href="appointment.room_url_1"
                                            target="_blank"
                                            class="room-link"
                                        >
                                            {{ formatRoomUrl(appointment.room_url_1) }}
                                        </a>
                                        <div v-else class="no-url">
                                            No room URL set
                                        </div>
                                        <div class="view-actions">
                                            <button
                                                v-if="appointment.room_url_1"
                                                class="copy-btn"
                                                @click="copyToClipboard(appointment.room_url_1)"
                                            >
                                                Copy
                                            </button>
                                            <button
                                                v-if="appointment.room_url_1"
                                                class="test-btn"
                                                @click="testRoomUrl(appointment.room_url_1, 1)"
                                            >
                                                Test
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Room 2 -->
                                <div class="room-card">
                                    <div class="room-header">
                                        <span class="room-icon">🔗</span>
                                        <h3>Room 2</h3>
                                        <span v-if="appointment.room_url_2" class="room-status">Active</span>
                                        <span v-else class="room-status inactive">Not Set</span>
                                    </div>

                                    <div v-if="isEditingRooms" class="room-edit">
                                        <div class="input-group">
                                            <label for="room2">Room 2 URL:</label>
                                            <input
                                                type="url"
                                                id="room2"
                                                v-model="roomUrl2"
                                                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                                                class="url-input"
                                            />
                                            <div class="input-help">
                                                Optional: Backup room or monitoring room
                                            </div>
                                        </div>
                                        <div class="room-actions">
                                            <button
                                                v-if="appointment.room_url_2"
                                                class="clear-btn"
                                                @click="clearRoomUrl(2)"
                                                :disabled="savingRooms"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                class="test-btn"
                                                @click="testRoomUrl(roomUrl2, 2)"
                                                :disabled="!roomUrl2 || savingRooms"
                                            >
                                                Test Link
                                            </button>
                                        </div>
                                    </div>
                                    <div v-else class="room-view">
                                        <a
                                            v-if="appointment.room_url_2"
                                            :href="appointment.room_url_2"
                                            target="_blank"
                                            class="room-link"
                                        >
                                            {{ formatRoomUrl(appointment.room_url_2) }}
                                        </a>
                                        <div v-else class="no-url">
                                            No room URL set
                                        </div>
                                        <div class="view-actions">
                                            <button
                                                v-if="appointment.room_url_2"
                                                class="copy-btn"
                                                @click="copyToClipboard(appointment.room_url_2)"
                                            >
                                                Copy
                                            </button>
                                            <button
                                                v-if="appointment.room_url_2"
                                                class="test-btn"
                                                @click="testRoomUrl(appointment.room_url_2, 2)"
                                            >
                                                Test
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="!appointment.room_url_1 && !appointment.room_url_2 && !isEditingRooms" class="no-rooms">
                                    <span class="no-rooms-icon">🚫</span>
                                    <p>No rooms assigned yet</p>
                                    <button class="add-room-btn" @click="startEditingRooms">
                                        Add Rooms
                                    </button>
                                </div>
                            </div>

                            <div v-if="isEditingRooms" class="rooms-tips">
                                <h4>Tips for Room URLs:</h4>
                                <ul>
                                    <li>Use a secure video conferencing service (Google Meet, Zoom, etc.)</li>
                                    <li>Room 1 is the main exam room</li>
                                    <li>Room 2 is optional for backup or monitoring</li>
                                    <li>Make sure the student has access to the room</li>
                                    <li>Test the links before saving</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: User Info & Controls -->
                    <div class="details-column">
                        <!-- User Information -->
                        <div class="details-section">
                            <h2>Student Information</h2>
                            <div class="user-card">
                                <div class="user-header">
                                    <div class="user-avatar">
                                        {{ getUserInitials(appointment.username) }}
                                    </div>
                                    <div class="user-info">
                                        <h3>{{ appointment.username }}</h3>
                                        <p class="user-id">ID: {{ appointment.user_id }}</p>
                                    </div>
                                </div>
                                <div class="user-details">
                                    <div class="detail-item">
                                        <span class="detail-icon">👤</span>
                                        <span class="detail-text">Username: {{ appointment.username }}</span>
                                    </div>
                                    <div class="detail-item">
                                        <span class="detail-icon">🆔</span>
                                        <span class="detail-text">User ID: {{ appointment.user_id }}</span>
                                    </div>
                                    <div class="detail-item" v-if="appointment.is_entered">
                                        <span class="detail-icon">⏱️</span>
                                        <span class="detail-text">Entered: {{ formatDateTime(appointment.entered_datetime || '') }}</span>
                                    </div>
                                    <div class="detail-item" v-if="appointment.exam_time">
                                        <span class="detail-icon">⏰</span>
                                        <span class="detail-text">Exam Time: {{ appointment.exam_time }} minutes</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Proctor Controls -->
                        <div class="details-section">
                            <h2>Proctor Controls</h2>
                            <div class="controls-card">
                                <div class="control-group">
                                    <h3>Exam Control</h3>
                                    <div class="control-item">
                                        <label class="control-label">
                                            <input
                                                type="checkbox"
                                                v-model="canStart"
                                                @change="updateCanStart"
                                                :disabled="updating"
                                            />
                                            <span>Allow Student to Start Exam</span>
                                        </label>
                                        <p class="control-help">
                                            When checked, the student will be able to start the exam.
                                            Make sure rooms are set and you're ready to proctor.
                                        </p>
                                    </div>

                                    <div class="control-item" v-if="appointment.is_entered">
                                        <label class="control-label">
                                            <span class="entered-status">✅ Student has entered the exam</span>
                                        </label>
                                        <p class="control-help">
                                            Student entered at: {{ formatDateTime(appointment.entered_datetime || '') }}
                                        </p>
                                    </div>
                                </div>

                                <div class="control-group">
                                    <h3>Status Management</h3>
                                    <div class="status-buttons">
                                        <button
                                            v-for="status in availableStatuses"
                                            :key="status"
                                            class="status-btn"
                                            :class="{
                                                'active': appointment.appointment_status === status,
                                                'disabled': updating
                                            }"
                                            @click="updateStatus(status)"
                                            :disabled="updating"
                                        >
                                            {{ status }}
                                        </button>
                                    </div>
                                    <p class="status-help">
                                        Current: <strong>{{ appointment.appointment_status }}</strong>
                                    </p>
                                </div>

                                <div class="control-actions">
                                    <button
                                        class="save-btn"
                                        @click="saveAllChanges"
                                        :disabled="!hasChanges || updating"
                                    >
                                        <span v-if="updating">Saving...</span>
                                        <span v-else>Save All Changes</span>
                                    </button>
                                    <button
                                        class="refresh-btn"
                                        @click="loadAppointmentDetails"
                                        :disabled="updating"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { examService, type ExamAppointment } from '@/services/exam.service';
import { notificationService } from '@/services/notification.service';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const appointment = ref<ExamAppointment | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const updating = ref(false);
const savingRooms = ref(false);
const isEditingRooms = ref(false);

// Form data
const canStart = ref(false);
const roomUrl1 = ref('');
const roomUrl2 = ref('');

// Original values for change detection
const originalCanStart = ref(false);
const originalRoomUrl1 = ref('');
const originalRoomUrl2 = ref('');

const appointmentId = computed(() => route.params.id as string);

const availableStatuses = [
    'No Reservation Yet',
    'Scheduled',
    'In Progress',
    'Completed',
    'Taken but Failed',
    'Cancelled',
    'Expired'
];

// Check if any changes were made
const hasChanges = computed(() => {
    return canStart.value !== originalCanStart.value ||
           roomUrl1.value !== originalRoomUrl1.value ||
           roomUrl2.value !== originalRoomUrl2.value;
});

// Load appointment details
const loadAppointmentDetails = async () => {
    if (!appointmentId.value) {
        error.value = 'No appointment ID provided';
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        appointment.value = await examService.getAppointmentById(appointmentId.value);

        // Set form values
        canStart.value = appointment.value.can_start;
        originalCanStart.value = appointment.value.can_start;

        roomUrl1.value = appointment.value.room_url_1 || '';
        roomUrl2.value = appointment.value.room_url_2 || '';
        originalRoomUrl1.value = appointment.value.room_url_1 || '';
        originalRoomUrl2.value = appointment.value.room_url_2 || '';
    } catch (err: any) {
        error.value = err.message || 'Failed to load appointment details';
    } finally {
        loading.value = false;
    }
};

// Start editing rooms
const startEditingRooms = () => {
    isEditingRooms.value = true;
};

// Save room URLs
const saveRoomUrls = async () => {
    if (!appointment.value) return;

    savingRooms.value = true;

    try {
        const updates: any = {};
        if (roomUrl1.value !== originalRoomUrl1.value) {
            updates.room_url_1 = roomUrl1.value || null;
        }
        if (roomUrl2.value !== originalRoomUrl2.value) {
            updates.room_url_2 = roomUrl2.value || null;
        }

        if (Object.keys(updates).length > 0) {
            const updated = await examService.updateExamAppointment(
                appointment.value.external_id,
                updates
            );

            appointment.value = updated;
            originalRoomUrl1.value = roomUrl1.value;
            originalRoomUrl2.value = roomUrl2.value;

            showNotification('Room URLs saved successfully!', 'success');
        } else {
            showNotification('No changes to save', 'info');
        }

        isEditingRooms.value = false;
    } catch (err: any) {
        error.value = err.message || 'Failed to save room URLs';
        showNotification('Failed to save room URLs', 'error');
    } finally {
        savingRooms.value = false;
    }
};

// Clear room URL
const clearRoomUrl = (roomNumber: number) => {
    if (roomNumber === 1) {
        roomUrl1.value = '';
    } else {
        roomUrl2.value = '';
    }
};

// Test room URL
const testRoomUrl = (url: string, roomNumber: number) => {
    if (!url) {
        showNotification(`Please enter Room ${roomNumber} URL first`, 'warning');
        return;
    }

    try {
        // Validate URL
        new URL(url);

        // Open in new tab
        window.open(url, '_blank');
        showNotification(`Opening Room ${roomNumber} in new tab...`, 'info');
    } catch (err) {
        showNotification(`Invalid URL for Room ${roomNumber}. Please check the format.`, 'error');
    }
};

/**
 * Tell the candidate they may start.
 *
 * Only on the false -> true edge. `can_start` is deliberately revocable (it is
 * not in app 20's MONOTONIC_FLAGS), so it can be toggled several times while a
 * proctor sets a room up, and a notification per toggle would be a bell ringing
 * at somebody who is already sitting in front of the exam page.
 */
const announceApproval = (wasAllowed: boolean) => {
    if (wasAllowed || !canStart.value || !appointment.value) return;
    const student = appointment.value.username;
    if (!student) return;
    notificationService.notify('exam.appointment_approved', {
        to: student,
        sender: authStore.user?.username || 'system',
        params: {
            exam: appointment.value.exam_title || 'your exam',
            when: appointment.value.appointment_date
                ? new Date(appointment.value.appointment_date).toLocaleString()
                : 'the scheduled time',
        },
    });
};

// Update can_start status
const updateCanStart = async () => {
    if (!appointment.value) return;

    updating.value = true;
    const wasAllowed = originalCanStart.value;

    try {
        const updated = await examService.updateExamAppointment(
            appointment.value.external_id,
            { can_start: canStart.value }
        );

        appointment.value = updated;
        originalCanStart.value = canStart.value;
        announceApproval(wasAllowed);

        showNotification('Exam control updated successfully!', 'success');
    } catch (err: any) {
        error.value = err.message || 'Failed to update exam control';
        // Revert the change
        canStart.value = originalCanStart.value;
        showNotification('Failed to update exam control', 'error');
    } finally {
        updating.value = false;
    }
};

// Update appointment status
const updateStatus = async (status: string) => {
    if (!appointment.value) return;

    updating.value = true;

    try {
        const updated = await examService.updateAppointmentStatus(
            appointment.value.external_id,
            status,
            canStart.value
        );

        appointment.value = updated;
        showNotification(`Status updated to ${status}`, 'success');
    } catch (err: any) {
        error.value = err.message || 'Failed to update status';
        showNotification('Failed to update status', 'error');
    } finally {
        updating.value = false;
    }
};

// Save all changes (rooms and can_start)
const saveAllChanges = async () => {
    if (!hasChanges.value || !appointment.value) return;

    updating.value = true;
    const wasAllowed = originalCanStart.value;

    try {
        const updates: any = {};

        // Check each field and add to updates if changed
        if (canStart.value !== originalCanStart.value) {
            updates.can_start = canStart.value;
        }
        if (roomUrl1.value !== originalRoomUrl1.value) {
            updates.room_url_1 = roomUrl1.value || null;
        }
        if (roomUrl2.value !== originalRoomUrl2.value) {
            updates.room_url_2 = roomUrl2.value || null;
        }

        if (Object.keys(updates).length > 0) {
            const updated = await examService.updateExamAppointment(
                appointment.value.external_id,
                updates
            );

            appointment.value = updated;

            // Update original values
            if (updates.can_start !== undefined) {
                originalCanStart.value = canStart.value;
                announceApproval(wasAllowed);
            }
            if (updates.room_url_1 !== undefined) {
                originalRoomUrl1.value = roomUrl1.value;
            }
            if (updates.room_url_2 !== undefined) {
                originalRoomUrl2.value = roomUrl2.value;
            }

            showNotification('All changes saved successfully!', 'success');

            // Exit edit mode if we were editing rooms
            if (isEditingRooms.value) {
                isEditingRooms.value = false;
            }
        } else {
            showNotification('No changes to save', 'info');
        }
    } catch (err: any) {
        error.value = err.message || 'Failed to save changes';
        showNotification('Failed to save changes', 'error');
    } finally {
        updating.value = false;
    }
};

// Format room URL for display
const formatRoomUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        // Truncate long URLs
        const maxLength = 40;
        const path = urlObj.pathname + urlObj.search;
        if (path.length > maxLength) {
            return urlObj.hostname + path.substring(0, maxLength) + '...';
        }
        return urlObj.hostname + path;
    } catch {
        // If URL is invalid, truncate it
        return url.length > 50 ? url.substring(0, 50) + '...' : url;
    }
};

// Format date and time
const formatDateTime = (dateString: string): string => {
    if (!dateString) return 'Not set';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
};

// Get status CSS class
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

// Get user initials for avatar
const getUserInitials = (username: string): string => {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
};

// Copy to clipboard
const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
        .then(() => {
            showNotification('Link copied to clipboard!', 'success');
        })
        .catch(() => {
            showNotification('Failed to copy link', 'error');
        });
};

// Show notification
const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    // You can integrate with your notification system here
    alert(`${type.toUpperCase()}: ${message}`);
};

// Go back to dashboard
const goBack = () => {
    router.push('/proctor-dashboard');
};

// Watch for URL changes
watch(() => route.params.id, () => {
    if (route.name === 'ProctorExamAppointment') {
        loadAppointmentDetails();
    }
});

onMounted(() => {
    if (authStore.isProctor) {
        loadAppointmentDetails();
    } else {
        error.value = 'You are not authorized as a proctor';
    }
});
</script>

<style scoped>
@import '@/assets/css/proctor-exam-appointment.css';
</style>
