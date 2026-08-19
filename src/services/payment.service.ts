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

    /**
     * Low-level helper: PATCH a payment's status.
     */
    private async patchStatus(
        baseUrl: string,
        externalId: string,
        newStatus: Payment['status'],
        notes?: string
    ): Promise<Payment> {
        return await apiService.patch<Payment>(
            baseUrl,
            `/payments/${externalId}/`,
            {
                status: newStatus,
                notes: notes || `Status changed to ${newStatus} by admin at ${new Date().toISOString()}`
            }
        );
    }

    /**
     * Admin action: approve a payment -> end state VERIFIED.
     *
     * Many payment backends enforce a state machine and reject jumping straight
     * from PENDING to VERIFIED (that returns HTTP 400). So we try the direct
     * transition first, and if it fails we transition sequentially:
     *   PENDING -> PAID -> VERIFIED
     */
    async approvePayment(externalId: string, notes?: string): Promise<Payment> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        const note = notes || `Payment approved & verified by admin at ${new Date().toISOString()}`;

        // 1) Try direct PENDING -> VERIFIED
        try {
            return await this.patchStatus(baseUrl, externalId, 'VERIFIED', note);
        } catch (err: any) {
            console.warn('Direct VERIFIED transition failed, trying PAID -> VERIFIED:', err?.status, err?.data);

            // Only attempt the sequential path on a 400 (invalid transition)
            if (err?.status && err.status !== 400) {
                throw err;
            }

            // 2) Move to PAID first (ignore failure if it's already PAID)
            try {
                await this.patchStatus(baseUrl, externalId, 'PAID', note);
            } catch (paidErr: any) {
                console.warn('PAID transition failed (continuing to VERIFIED anyway):', paidErr?.status, paidErr?.data);
            }

            // 3) Then move to VERIFIED
            try {
                return await this.patchStatus(baseUrl, externalId, 'VERIFIED', note);
            } catch (verifyErr: any) {
                // 4) Last resort: leave it as PAID and return the current record
                console.warn('VERIFIED transition still failing; leaving payment as PAID:', verifyErr?.status, verifyErr?.data);
                return await this.getPaymentStatus(externalId);
            }
        }
    }

    /**
     * Admin action: reject/ignore a payment -> mark as REJECTED.
     */
    async rejectPayment(externalId: string, notes?: string): Promise<Payment> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await this.patchStatus(
                baseUrl,
                externalId,
                'REJECTED',
                notes || `Payment ignored/rejected by admin at ${new Date().toISOString()}`
            );
        } catch (error) {
            console.error('Failed to reject payment:', error);
            throw error;
        }
    }

    async cancelPayment(externalId: string, notes?: string): Promise<Payment> {
        const baseUrl = await serviceRegistry.getRandomPaymentReplica();
        if (!baseUrl) {
            throw new Error('No payment service replicas available');
        }

        try {
            return await this.patchStatus(
                baseUrl,
                externalId,
                'REJECTED',
                notes || `Payment cancelled by user at ${new Date().toISOString()}`
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
    // The appId is what pins this tab to one replica. Without it every call
    // re-rolled the choice, so a read straight after a write was a coin flip on
    // whether the write had replicated yet - see getRandomReplica in config.ts.
    const appId = parseInt(import.meta.env.VITE_PAYMENT_APP_ID || '23');
    const replicas = await serviceRegistry.getServiceReplicas(appId, 'payment');
    return serviceRegistry.getRandomReplica(replicas, appId);
}

// Update service registry to include payment methods
serviceRegistry.getRandomPaymentReplica = getRandomPaymentReplica;