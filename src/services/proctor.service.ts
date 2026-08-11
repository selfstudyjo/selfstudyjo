import { apiService } from './api';
import { serviceRegistry } from './config';
import { normalizePaginatedResponse } from '@/utils/api-utils';

export interface ExamProctor {
    external_id: string;
    user_id: string;
    username: string;
    email: string;
    phone?: string;
    date_created: string;
    is_active: boolean;
    available_days?: AvailableDay[];
}

export interface ProctorCheckResponse {
    is_proctor: boolean;
    proctor?: {
        external_id: string;
        user_id: string;
        username: string;
        email: string;
    };
    error?: string;
}

export interface AvailableDay {
    id: number;
    sync_id: string;
    proctor: string;
    proctor_external_id?: string;
    proctor_name?: string;
    day: string;
    is_available: boolean;
    available_hours?: AvailableHour[];
}

export interface AvailableHour {
    id: number;
    sync_id: string;
    available_day: number;
    available_day_sync_id?: string;
    start_time: string;
    end_time: string;
    is_available: boolean;
    day?: string; // Added for filtering
}

export interface ProctorAvailability {
    proctor_id: string;
    date: string;
    available_slots: AvailableSlot[];
}

export interface AvailableSlot {
    start_time: string;
    end_time: string;
    is_available: boolean;
}

export interface UpdateAvailabilityRequest {
    day_id?: number;
    day_sync_id?: string;
    hour_id?: number;
    hour_sync_id?: string;
    is_available: boolean;
}

/** A slot starting sooner than this is no longer offerable. */
const HOUR_LEAD_MINUTES = 60;

class ProctorService {
    private readonly APP_ID = 21; // From .env VITE_PROCTOR_APP_ID

    async getProctorReplicas(): Promise<string[]> {
        return serviceRegistry.getServiceReplicas(this.APP_ID, 'proctor');
    }

    async getRandomProctorReplica(): Promise<string | null> {
        const replicas = await this.getProctorReplicas();
        return serviceRegistry.getRandomReplica(replicas);
    }

    // New method to check if user is a proctor
    async checkIfUserIsProctor(userId: string): Promise<ProctorCheckResponse> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const response = await apiService.post<ProctorCheckResponse>(
                baseUrl,
                '/check-proctor/',
                { user_id: userId }
            );
            return response;
        } catch (error: any) {
            return {
                is_proctor: false,
                proctor: undefined,
                error: error.message || 'Failed to check proctor status'
            };
        }
    }

    /**
     * `YYYY-MM-DD` in the local calendar.
     *
     * A plain date string is returned untouched, and that is the whole point:
     * `new Date('2026-08-15')` is parsed as UTC midnight, so re-formatting an
     * already-plain date through it yields the 14th for every user west of UTC.
     * The booking page then asked app 21 for the wrong day, the day it got back
     * did not match the one it was looking for, and every single date on the
     * calendar answered "no available time slots".
     */
    private formatDate(date: Date | string): string {
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
            return date.trim();
        }
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * The hours a student can still take on a given day: open, and not about to
     * start. `new Date('2026-08-15T08:00:00')` has no zone, so it is parsed in
     * local time — which is what a proctor's working hours are expressed in.
     */
    private bookableHours(dayIso: string, hours: AvailableHour[] = [],
                          leadMinutes = HOUR_LEAD_MINUTES): AvailableHour[] {
        const cutoff = new Date(Date.now() + leadMinutes * 60 * 1000);
        return hours.filter(hour => {
            if (!hour.is_available) return false;
            const start = new Date(`${this.formatDate(dayIso)}T${hour.start_time}`);
            return !isNaN(start.getTime()) && start >= cutoff;
        });
    }

    // Get all proctors
    async getProctors(): Promise<ExamProctor[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const response = await apiService.get<any>(baseUrl, '/proctors/');
            return normalizePaginatedResponse<ExamProctor>(response).results;
        } catch (error) {
            throw error;
        }
    }

    // Get proctor by ID
    async getProctor(proctorId: string): Promise<ExamProctor> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            return await apiService.get<ExamProctor>(baseUrl, `/proctors/${proctorId}/`);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Every day a proctor has on record between two dates, with its hours.
     *
     * One request, not thirty-one: `GET /available-days/` already nests
     * `available_hours` in each day, so the old per-day `/available-hours/`
     * follow-up was fetching what it had just been handed. The follow-up is kept
     * only for a day that arrives without the nested list.
     *
     * `bookableOnly` (the default) drops hours somebody has taken and hours
     * about to start. Pass `false` when you need the day exactly as stored —
     * freeing a slot means finding an hour that is, by definition, not
     * available, and filtering it out is why cancelling never released one.
     */
    async getProctorAvailability(proctorId: string, startDate: string, endDate?: string,
                                 options: { bookableOnly?: boolean } = {}): Promise<AvailableDay[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        const bookableOnly = options.bookableOnly !== false;
        const params = new URLSearchParams();
        params.append('proctor_id', proctorId);
        params.append('date_from', this.formatDate(startDate));
        params.append('date_to', this.formatDate(endDate || startDate));

        const response = await apiService.get<any>(baseUrl, `/available-days/?${params.toString()}`);
        const days = normalizePaginatedResponse<AvailableDay>(response).results;

        return Promise.all(days.map(async (day) => {
            let hours = Array.isArray(day.available_hours) ? day.available_hours : null;
            if (!hours) {
                try {
                    hours = await this.getAvailableHoursForDay(day.id, baseUrl);
                } catch {
                    hours = [];
                }
            }
            return {
                ...day,
                available_hours: bookableOnly ? this.bookableHours(day.day, hours) : hours,
            };
        }));
    }

    /** One day's bookable slots, or null when the proctor has no record for it. */
    async getProctorAvailabilityForDate(proctorId: string, date: string): Promise<AvailableDay | null> {
        const iso = this.formatDate(date);
        const days = await this.getProctorAvailability(proctorId, iso, iso);
        return days.find(day => this.formatDate(day.day) === iso) || null;
    }

    /**
     * One day exactly as stored, taken slots included. This is what releasing a
     * slot has to read: the hour being freed is the one marked unavailable.
     */
    async getProctorDayRaw(proctorId: string, date: string): Promise<AvailableDay | null> {
        const iso = this.formatDate(date);
        const days = await this.getProctorAvailability(proctorId, iso, iso, { bookableOnly: false });
        return days.find(day => this.formatDate(day.day) === iso) || null;
    }

    /** Fallback for a day that arrived without its nested hours. Unfiltered. */
    async getAvailableHoursForDay(dayId: number, baseUrl?: string): Promise<AvailableHour[]> {
        const url = baseUrl || await this.getRandomProctorReplica();
        if (!url) {
            throw new Error('No proctor service replicas available');
        }

        const response = await apiService.get<any>(url, `/available-hours/?day_id=${dayId}`);
        return normalizePaginatedResponse<AvailableHour>(response).results;
    }

    // Find available proctors for a specific date and time
    async findAvailableProctors(date: string, time: string): Promise<ExamProctor[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const formattedDate = this.formatDate(date);
            const endpoint = `/find-available-proctors/?date=${formattedDate}&time=${time}`;
            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<ExamProctor>(response).results;
        } catch (error) {
            throw error;
        }
    }

    // Update availability - This should work with your Django view
    async updateAvailability(request: UpdateAvailabilityRequest): Promise<any> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            // Remove undefined values
            const cleanRequest: any = {};
            if (request.day_id !== undefined) cleanRequest.day_id = request.day_id;
            if (request.day_sync_id !== undefined) cleanRequest.day_sync_id = request.day_sync_id;
            if (request.hour_id !== undefined) cleanRequest.hour_id = request.hour_id;
            if (request.hour_sync_id !== undefined) cleanRequest.hour_sync_id = request.hour_sync_id;
            cleanRequest.is_available = request.is_available;

            // Your Django view expects PATCH for UpdateAvailabilityView
            return await apiService.patch<any>(
                baseUrl,
                '/update-availability/',
                cleanRequest
            );
        } catch (error) {
            throw error;
        }
    }

    // Update hour availability directly
    async updateHourAvailability(hourId: number, isAvailable: boolean): Promise<AvailableHour> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            // Use PATCH to update just the is_available field
            return await apiService.patch<AvailableHour>(
                baseUrl,
                `/available-hours/${hourId}/`,
                { is_available: isAvailable }
            );
        } catch (error) {
            throw error;
        }
    }

    // Find hour by sync_id
    async findHourBySyncId(syncId: string): Promise<AvailableHour | null> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const endpoint = `/available-hours/?sync_id=${syncId}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            const hours = normalizePaginatedResponse<AvailableHour>(response).results;

            return hours.length > 0 ? hours[0] : null;
        } catch (error) {
            return null;
        }
    }

    // Get hour by ID (new method)
    async getHourById(hourId: number): Promise<AvailableHour> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            return await apiService.get<AvailableHour>(
                baseUrl,
                `/available-hours/${hourId}/`
            );
        } catch (error) {
            throw error;
        }
    }

    // Get available hours by sync IDs (new method)
    async getHoursBySyncIds(syncIds: string[]): Promise<AvailableHour[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const params = new URLSearchParams();
            syncIds.forEach(id => params.append('sync_id', id));

            const endpoint = `/available-hours/?${params.toString()}`;

            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<AvailableHour>(response).results;
        } catch (error) {
            throw error;
        }
    }
}

export const proctorService = new ProctorService();
