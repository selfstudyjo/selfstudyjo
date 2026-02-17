import { apiService } from './api';
import { serviceRegistry } from './config';

export interface OTPGenerationRequest {
    user_id: string;
    email: string;
    username: string;
}

export interface OTPGenerationResponse {
    user_id: string;
    email: string;
    created_at: string;
    email_sent?: boolean;
    warning?: string;
}

export interface OTPVerificationRequest {
    user_id: string;
    code: string;
}

export interface OTPVerificationResponse {
    status: string;
    user_id: string;
    email: string;
    email_verified: boolean;
    verified_domain?: string;
    warning?: string;
}

export interface ResendOTPRequest {
    user_id: string;
    email: string;
    username: string;
}

class OTPService {
    async generateOTP(request: OTPGenerationRequest): Promise<OTPGenerationResponse> {
        const baseUrl = await serviceRegistry.getRandomOtpReplica();
        if (!baseUrl) {
            throw new Error('No OTP service replicas available');
        }

        try {
            return await apiService.post<OTPGenerationResponse>(
                baseUrl,
                '/generate/',
                request
            );
        } catch (error) {
            console.error('OTP generation failed:', error);
            throw error;
        }
    }

    async verifyOTP(request: OTPVerificationRequest): Promise<OTPVerificationResponse> {
        const baseUrl = await serviceRegistry.getRandomOtpReplica();
        if (!baseUrl) {
            throw new Error('No OTP service replicas available');
        }

        try {
            return await apiService.post<OTPVerificationResponse>(
                baseUrl,
                '/verify/',
                request
            );
        } catch (error) {
            console.error('OTP verification failed:', error);
            throw error;
        }
    }

    async resendOTP(request: ResendOTPRequest): Promise<OTPGenerationResponse> {
        const baseUrl = await serviceRegistry.getRandomOtpReplica();
        if (!baseUrl) {
            throw new Error('No OTP service replicas available');
        }

        try {
            return await apiService.post<OTPGenerationResponse>(
                baseUrl,
                '/resend/',
                request
            );
        } catch (error) {
            console.error('OTP resend failed:', error);
            throw error;
        }
    }
}

export const otpService = new OTPService();
