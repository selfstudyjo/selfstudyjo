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
            console.log('🔍 [ProctorService] Checking if user is proctor:', userId);
            const response = await apiService.post<ProctorCheckResponse>(
                baseUrl,
                '/check-proctor/',
                { user_id: userId }
            );
            console.log('✅ [ProctorService] Proctor check response:', response);
            return response;
        } catch (error: any) {
            console.error('❌ [ProctorService] Failed to check proctor status:', error);
            return {
                is_proctor: false,
                proctor: undefined,
                error: error.message || 'Failed to check proctor status'
            };
        }
    }

    // Format date to YYYY-MM-DD
    private formatDate(date: Date | string): string {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Parse date string to Date object, handling timezone issues
    private parseDate(dateStr: string): Date {
        // If dateStr already includes time, parse directly
        if (dateStr.includes('T')) {
            return new Date(dateStr);
        }
        // If it's just a date string, create date at noon to avoid timezone issues
        return new Date(`${dateStr}T12:00:00`);
    }

    // Compare two dates ignoring time
    private areDatesEqual(date1: Date, date2: Date): boolean {
        return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
    }

    // Get all proctors
    async getProctors(): Promise<ExamProctor[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            console.log('🔍 [ProctorService] Fetching proctors:', `${baseUrl}/proctors/`);
            const response = await apiService.get<any>(baseUrl, '/proctors/');
            return normalizePaginatedResponse<ExamProctor>(response).results;
        } catch (error) {
            console.error('❌ [ProctorService] Failed to fetch proctors:', error);
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
            console.log('🔍 [ProctorService] Fetching proctor:', `${baseUrl}/proctors/${proctorId}/`);
            return await apiService.get<ExamProctor>(baseUrl, `/proctors/${proctorId}/`);
        } catch (error) {
            console.error('❌ [ProctorService] Failed to fetch proctor:', error);
            throw error;
        }
    }

    // Get proctor availability for specific dates - FIXED VERSION
    async getProctorAvailability(proctorId: string, startDate: string, endDate?: string): Promise<AvailableDay[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const params = new URLSearchParams();
            params.append('proctor_id', proctorId);
            params.append('date_from', startDate);
            if (endDate) {
                params.append('date_to', endDate);
            }

            const endpoint = `/available-days/?${params.toString()}`;
            console.log('🔍 [ProctorService] Fetching proctor availability:', `${baseUrl}${endpoint}`);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const days = normalizePaginatedResponse<AvailableDay>(response).results;

            console.log('📅 Raw days from API:', days);

            // Get hours for each day with proper filtering
            const enrichedDays = await Promise.all(
                days.map(async (day) => {
                    try {
                        const hours = await this.getAvailableHoursForDay(day.id);
                        console.log(`📅 Day ${day.day} has ${hours.length} hours:`, hours);
                        return {
                            ...day,
                            available_hours: hours.filter(hour => {
                                // Only include hours that are marked as available
                                const isHourAvailable = hour.is_available;

                                // Check if the time slot is still valid (not in the past)
                                const dayDate = this.parseDate(day.day);
                                const hourStartTime = new Date(`${this.formatDate(dayDate)}T${hour.start_time}`);
                                const now = new Date();

                                // Allow slots that are at least 1 hour in the future
                                const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

                                const isValid = isHourAvailable && hourStartTime >= oneHourFromNow;
                                console.log(`⏰ Hour ${hour.start_time}-${hour.end_time} for ${day.day}: available=${isHourAvailable}, future=${hourStartTime >= oneHourFromNow}, valid=${isValid}`);
                                return isValid;
                            })
                        };
                    } catch (error) {
                        console.warn(`⚠️ Could not fetch hours for day ${day.id}:`, error);
                        return { ...day, available_hours: [] };
                    }
                })
            );

            console.log('✅ Enriched days:', enrichedDays);
            return enrichedDays;
        } catch (error) {
            console.error('❌ [ProctorService] Failed to fetch proctor availability:', error);
            throw error;
        }
    }

    // Get proctor availability for a specific date only - NEW METHOD
    async getProctorAvailabilityForDate(proctorId: string, date: string): Promise<AvailableDay | null> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            // Format the date properly
            const formattedDate = this.formatDate(date);

            const params = new URLSearchParams();
            params.append('proctor_id', proctorId);
            params.append('date_from', formattedDate);
            params.append('date_to', formattedDate); // Same date for both to get only one day

            const endpoint = `/available-days/?${params.toString()}`;
            console.log('🔍 [ProctorService] Fetching proctor availability for specific date:', `${baseUrl}${endpoint}`);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const days = normalizePaginatedResponse<AvailableDay>(response).results;

            if (days.length === 0) {
                console.log('📅 No availability data found for date:', formattedDate);
                return null;
            }

            // Find the exact day matching our date
            const targetDate = this.parseDate(date);
            const matchingDay = days.find(day => {
                const dayDate = this.parseDate(day.day);
                return this.areDatesEqual(dayDate, targetDate);
            });

            if (!matchingDay) {
                console.log('📅 No matching day found for date:', formattedDate);
                return null;
            }

            console.log('📅 Found matching day:', matchingDay);

            // Get hours for the specific day
            try {
                const hours = await this.getAvailableHoursForDay(matchingDay.id);
                const enrichedDay = {
                    ...matchingDay,
                    available_hours: hours.filter(hour => {
                        // Only include available hours
                        const isHourAvailable = hour.is_available;

                        // Check if the time slot is still valid (not in the past)
                        const hourStartTime = new Date(`${this.formatDate(matchingDay.day)}T${hour.start_time}`);
                        const now = new Date();

                        // Allow slots that are at least 1 hour in the future
                        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

                        const isValid = isHourAvailable && hourStartTime >= oneHourFromNow;
                        console.log(`⏰ Filtering hour ${hour.start_time}-${hour.end_time}: available=${isHourAvailable}, future=${hourStartTime >= oneHourFromNow}, valid=${isValid}`);
                        return isValid;
                    })
                };

                console.log('✅ Enriched day with hours:', enrichedDay);
                return enrichedDay;
            } catch (error) {
                console.warn(`⚠️ Could not fetch hours for day ${matchingDay.id}:`, error);
                return { ...matchingDay, available_hours: [] };
            }
        } catch (error) {
            console.error('❌ [ProctorService] Failed to fetch proctor availability for date:', error);
            throw error;
        }
    }

    // Get available hours for a specific day
    async getAvailableHoursForDay(dayId: number): Promise<AvailableHour[]> {
        const baseUrl = await this.getRandomProctorReplica();
        if (!baseUrl) {
            throw new Error('No proctor service replicas available');
        }

        try {
            const endpoint = `/available-hours/?day_id=${dayId}`;
            console.log('🔍 [ProctorService] Fetching available hours for day:', dayId);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const hours = normalizePaginatedResponse<AvailableHour>(response).results;

            console.log(`📅 Raw hours for day ${dayId}:`, hours);

            // Only return available hours
            const availableHours = hours.filter(hour => hour.is_available);
            console.log(`✅ Available hours for day ${dayId}:`, availableHours);

            return availableHours;
        } catch (error) {
            console.error('❌ [ProctorService] Failed to fetch available hours:', error);
            throw error;
        }
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
            console.log('🔍 [ProctorService] Finding available proctors:', `${baseUrl}${endpoint}`);
            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<ExamProctor>(response).results;
        } catch (error) {
            console.error('❌ [ProctorService] Failed to find available proctors:', error);
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
            console.log('🔍 [ProctorService] Updating availability:', request);

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
            console.error('❌ [ProctorService] Failed to update availability:', error);
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
            console.log('🔍 [ProctorService] Updating hour availability:', { hourId, isAvailable });

            // Use PATCH to update just the is_available field
            return await apiService.patch<AvailableHour>(
                baseUrl,
                `/available-hours/${hourId}/`,
                { is_available: isAvailable }
            );
        } catch (error) {
            console.error('❌ [ProctorService] Failed to update hour availability:', error);
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
            console.log('🔍 [ProctorService] Finding hour by sync_id:', syncId);

            const response = await apiService.get<any>(baseUrl, endpoint);
            const hours = normalizePaginatedResponse<AvailableHour>(response).results;

            return hours.length > 0 ? hours[0] : null;
        } catch (error) {
            console.error('❌ [ProctorService] Failed to find hour by sync_id:', error);
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
            console.log('🔍 [ProctorService] Getting hour by ID:', hourId);
            return await apiService.get<AvailableHour>(
                baseUrl,
                `/available-hours/${hourId}/`
            );
        } catch (error) {
            console.error('❌ [ProctorService] Failed to get hour by ID:', error);
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
            console.log('🔍 [ProctorService] Getting hours by sync IDs:', syncIds);

            const response = await apiService.get<any>(baseUrl, endpoint);
            return normalizePaginatedResponse<AvailableHour>(response).results;
        } catch (error) {
            console.error('❌ [ProctorService] Failed to get hours by sync IDs:', error);
            throw error;
        }
    }
}

export const proctorService = new ProctorService();
