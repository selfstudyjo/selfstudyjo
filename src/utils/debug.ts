import { serviceRegistry } from '@/services/config';

export async function debugServices() {
    console.log('=== DEBUG SERVICES ===');

    console.log('\n1. Environment Variables:');
    console.log('VITE_AUTH_TOKEN:', import.meta.env.VITE_AUTH_TOKEN ? '[SET]' : '[NOT SET]');
    console.log('VITE_API_BASE_REGISTRY:', import.meta.env.VITE_API_BASE_REGISTRY);
    console.log('VITE_REGISTRY_ALT:', import.meta.env.VITE_REGISTRY_ALT);
    console.log('VITE_AUTH_APP_ID:', import.meta.env.VITE_AUTH_APP_ID);
    console.log('VITE_USERPROFILE_APP_ID:', import.meta.env.VITE_USERPROFILE_APP_ID);
    console.log('VITE_OTP_APP_ID:', import.meta.env.VITE_OTP_APP_ID);

    console.log('\n2. Fetching Service Replicas:');

    try {
        // Test auth service
        console.log('\nAuth Service:');
        const authReplicas = await serviceRegistry.getServiceReplicas(
            parseInt(import.meta.env.VITE_AUTH_APP_ID || '15'),
                                                                      'auth'
        );
        console.log('Replicas:', authReplicas);

        // Test userprofile service
        console.log('\nUserProfile Service:');
        const userReplicas = await serviceRegistry.getServiceReplicas(
            parseInt(import.meta.env.VITE_USERPROFILE_APP_ID || '13'),
                                                                      'userprofile'
        );
        console.log('Replicas:', userReplicas);

        // Test OTP service
        console.log('\nOTP Service:');
        const otpReplicas = await serviceRegistry.getServiceReplicas(
            parseInt(import.meta.env.VITE_OTP_APP_ID || '14'),
                                                                     'otp'
        );
        console.log('Replicas:', otpReplicas);

        console.log('\n3. Testing Random Replica Selection:');
        const randomAuth = await serviceRegistry.getRandomAuthReplica();
        const randomUser = await serviceRegistry.getRandomUserProfileReplica();
        const randomOtp = await serviceRegistry.getRandomOtpReplica();
        console.log('Random Auth:', randomAuth);
        console.log('Random UserProfile:', randomUser);
        console.log('Random OTP:', randomOtp);

        return {
            authReplicas,
            userReplicas,
            otpReplicas,
            randomAuth,
            randomUser,
            randomOtp
        };
    } catch (error) {
        console.error('Debug error:', error);
        throw error;
    }
}

export async function testEndpoint(url: string, method: string = 'GET', data?: any) {
    console.log(`\n=== TEST ENDPOINT: ${method} ${url} ===`);

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Token ${import.meta.env.VITE_AUTH_TOKEN}`
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        console.log('Response Status:', response.status, response.statusText);

        const contentType = response.headers.get('content-type');
        let responseData;

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }

        console.log('Response Data:', responseData);

        return {
            status: response.status,
            data: responseData
        };
    } catch (error) {
        console.error('Test error:', error);
        throw error;
    }
}
