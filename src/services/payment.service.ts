import { apiService } from './api';
import { serviceRegistry } from './config';

export interface BankAccount {
    IBAN: string;
    country: string;
    city: string;
    branch: string;
    street_address: string;
    bank_name: string;
    full_name: string;
    is_active: boolean;
}

export interface CliqAccount {
    username: string;
    full_name: string;
    is_active: boolean;
}

export interface Payment {
    external_id: string;
    user_id: string;
    subscription_id: string;
    amount: string;
    currency: string;
    payment_method: 'IBAN' | 'CLIQ';
    bank_account: BankAccount | null;
    cliq_account: CliqAccount | null;
    status: 'PENDING' | 'PAID' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
    reference: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    expires_at: string;
}

export interface CreatePaymentRequest {
    external_id?: string;
    user_id: string;
    subscription_id: string;
    amount: string;
    currency?: string;
    payment_method: 'IBAN' | 'CLIQ';
    reference?: string;
    notes?: string;
}

export interface CancelPaymentRequest {
    notes?: string;
}

class PaymentService {
    async getBankAccounts(): Promise<BankAccount[]> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.get<BankAccount[]>(
                baseUrl,
                '/bank-accounts/'
            );
        } catch (error) {
            console.error('Failed to get bank accounts:', error);
            throw error;
        }
    }

    async getCliqAccounts(): Promise<CliqAccount[]> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.get<CliqAccount[]>(
                baseUrl,
                '/cliq-accounts/'
            );
        } catch (error) {
            console.error('Failed to get cliq accounts:', error);
            throw error;
        }
    }

    async createPayment(data: CreatePaymentRequest): Promise<Payment> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.post<Payment>(
                baseUrl,
                '/payments/',
                {
                    ...data,
                    currency: data.currency || 'JOD'
                }
            );
        } catch (error) {
            console.error('Failed to create payment:', error);
            throw error;
        }
    }

    async getUserPayments(userId: string): Promise<Payment[]> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.get<Payment[]>(
                baseUrl,
                `/payments/?user_id=${userId}`
            );
        } catch (error) {
            console.error('Failed to get user payments:', error);
            throw error;
        }
    }

    async getPaymentStatus(externalId: string): Promise<Payment> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.get<Payment>(
                baseUrl,
                `/payments/${externalId}/`
            );
        } catch (error) {
            console.error('Failed to get payment status:', error);
            throw error;
        }
    }

    async cancelPayment(externalId: string, notes?: string): Promise<Payment> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.patch<Payment>(
                baseUrl,
                `/payments/${externalId}/`,
                {
                    status: 'REJECTED',
                    notes: notes || `Payment cancelled by user at ${new Date().toISOString()}`
                }
            );
        } catch (error) {
            console.error('Failed to cancel payment:', error);
            throw error;
        }
    }

    async deletePayment(externalId: string): Promise<{ status: string }> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await apiService.delete<{ status: string }>(
                baseUrl,
                `/payments/${externalId}/`
            );
        } catch (error) {
            console.error('Failed to delete payment:', error);
            throw error;
        }
    }
}

export const paymentService = new PaymentService();

// Add payment service to service registry
export async function getRandomPaymentReplica(): Promise<string | null> {
    const replicas = await serviceRegistry.getServiceReplicas(
        parseInt(import.meta.env.VITE_PAYMENT_APP_ID || '23'),
                                                              'payment'
    );
    return serviceRegistry.getRandomReplica(replicas);
}

// Update service registry to include payment methods
serviceRegistry.getRandomPaymentReplica = getRandomPaymentReplica;
