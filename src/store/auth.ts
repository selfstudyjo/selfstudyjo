import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '@/services/auth.service';
import { userService } from '@/services/user.service';
import { proctorService } from '@/services/proctor.service';
import { mediaService } from '@/services/media.service';
import { otpService } from '@/services/otp.service';
import { labService } from '@/services/lab.service';
import { subscriptionService } from '@/services/subscription.service';
import type { LoginRequest, LoginResponse } from '@/services/auth.service';
import type {
    UserProfile,
    UpdateProfileRequest,
    ChangePasswordRequest,
    RegisterResponse,
    EmailVerificationRequest,
    CheckUsernameResponse,
    CheckEmailResponse,
    PasswordCheckRequest,
    PasswordCheckResponse
} from '@/services/user.service';
import type {
    OTPGenerationRequest,
    OTPVerificationRequest,
    OTPResponse
} from '@/services/otp.service';
import type { Student } from '@/services/lab.service';
import { serviceRegistry } from '@/services/config';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<any>(null);
    const token = ref<string | null>(null);
    const isAuthenticated = ref(false);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const requiresVerification = ref(false);
    const verificationData = ref<any>(null);
    const isProctor = ref(false);
    const proctorData = ref<any>(null);
    const studentRecord = ref<Student | null>(null);

    // Union of feature names from ALL non-expired active subscriptions
    const userFeatures = ref<string[]>([]);

    // NEW: All non-expired active subscriptions for the user
    const activeSubscriptions = ref<any[]>([]);

    // Backward-compatible "primary" subscription record
    // (the user's selected one, or the newest non-expired one)
    const activeSubscription = ref<any>(null);

    const subscriptionLoaded = ref(false);

    const initAuth = () => {
        const storedUser = authService.getUser();
        const storedToken = authService.getToken();

        if (storedUser && storedToken) {
            user.value = storedUser;
            token.value = storedToken;
            isAuthenticated.value = true;

            checkProctorStatus(storedUser.id).catch(err =>
                console.warn('Failed to check proctor status on init:', err)
            );

            if (storedUser.lab_url) {
                loadStudentRecord().catch(err =>
                    console.warn('Failed to load student record on init:', err)
                );
            }

            loadUserFeatures().catch(err =>
                console.warn('Failed to load user features on init:', err)
            );

            loadActiveSubscriptions().catch(err =>
                console.warn('Failed to load active subscriptions on init:', err)
            );
        }
    };

    /**
     * Load the UNION of features from ALL of the user's non-expired active subscriptions.
     * This ensures that when a user has multiple active subscriptions, they get the
     * combined set of features (e.g., runbook_feature from sub A + ai_feature from sub B).
     */
    const loadUserFeatures = async (): Promise<string[]> => {
        if (!user.value?.id) {
            userFeatures.value = [];
            return [];
        }
        try {
            const features = await subscriptionService.getAllUserFeatures(user.value.id);
            userFeatures.value = features;
            return features;
        } catch (error) {
            console.warn('Failed to load user features:', error);
            userFeatures.value = [];
            return [];
        }
    };

    /**
     * Load ALL non-expired active subscriptions for the user.
     * Also sets `activeSubscription` (singular) to the user's preferred / newest one
     * for backward compatibility with existing code paths.
     */
    const loadActiveSubscriptions = async (): Promise<any[]> => {
        if (!user.value?.id) {
            activeSubscriptions.value = [];
            activeSubscription.value = null;
            subscriptionLoaded.value = true;
            return [];
        }
        try {
            const subs = await subscriptionService.getUsableSubscriptions(user.value.id);
            activeSubscriptions.value = subs;

            // Maintain backward-compatible "primary" sub (selected/newest)
            const primary = await subscriptionService.getActiveUserSubscription(user.value.id);
            activeSubscription.value = primary || (subs.length > 0 ? subs[0] : null);

            return subs;
        } catch (error) {
            console.warn('Failed to load active subscriptions:', error);
            activeSubscriptions.value = [];
            activeSubscription.value = null;
            return [];
        } finally {
            subscriptionLoaded.value = true;
        }
    };

    /**
     * Backward-compatible alias kept for any existing callers.
     */
    const loadActiveSubscription = async (): Promise<any> => {
        await loadActiveSubscriptions();
        return activeSubscription.value;
    };

    const loadStudentRecord = async (): Promise<Student | null> => {
        if (!user.value?.username || !user.value?.lab_url) {
            studentRecord.value = null;
            return null;
        }

        try {
            const student = await labService.getOrCreateStudent(user.value.username, user.value.lab_url);
            studentRecord.value = student;
            if (!student) {
                return null;
            }
            return student;
        } catch (error) {
            console.warn('Failed to load student record (non-critical):', error);
            studentRecord.value = null;
            return null;
        }
    };

    const checkProctorStatus = async (userId: string): Promise<boolean> => {
        try {
            const response = await proctorService.checkIfUserIsProctor(userId);
            isProctor.value = response.is_proctor;
            proctorData.value = response.proctor;
            return response.is_proctor;
        } catch (error) {
            console.warn('Failed to check proctor status (non-critical):', error);
            isProctor.value = false;
            proctorData.value = null;
            return false;
        }
    };

    const checkAuth = async (): Promise<boolean> => {
        const storedUser = authService.getUser();
        const storedToken = authService.getToken();

        if (!storedUser || !storedToken) {
            isAuthenticated.value = false;
            user.value = null;
            token.value = null;
            userFeatures.value = [];
            activeSubscriptions.value = [];
            activeSubscription.value = null;
            return false;
        }

        try {
            user.value = storedUser;
            token.value = storedToken;

            try {
                const authenticated = await authService.checkAndRefreshAuth();
                isAuthenticated.value = authenticated;
                if (!authenticated) {
                    user.value = null;
                    token.value = null;
                    isProctor.value = false;
                    proctorData.value = null;
                    studentRecord.value = null;
                    userFeatures.value = [];
                    activeSubscriptions.value = [];
                    activeSubscription.value = null;
                    return false;
                }
            } catch (authError) {
                console.warn('Server auth check failed, using local validation:', authError);
                const expiresAt = new Date(storedUser.expiresAt);
                const now = new Date();
                const isValid = expiresAt > now;
                isAuthenticated.value = isValid;
                if (!isValid) {
                    user.value = null;
                    token.value = null;
                    isProctor.value = false;
                    proctorData.value = null;
                    studentRecord.value = null;
                    userFeatures.value = [];
                    activeSubscriptions.value = [];
                    activeSubscription.value = null;
                    authService.clearAuth();
                    return false;
                }
            }

            if (isAuthenticated.value && user.value?.id) {
                checkProctorStatus(user.value.id).catch(err =>
                    console.warn('Background proctor check failed:', err)
                );
                if (user.value.lab_url) {
                    loadStudentRecord().catch(err =>
                        console.warn('Background student record load failed:', err)
                    );
                }
                loadUserFeatures().catch(err =>
                    console.warn('Background user features load failed:', err)
                );
                loadActiveSubscriptions().catch(err =>
                    console.warn('Background active subscriptions load failed:', err)
                );
            }

            return isAuthenticated.value;
        } catch (err) {
            console.error('Auth check failed completely:', err);
            isAuthenticated.value = false;
            user.value = null;
            token.value = null;
            isProctor.value = false;
            proctorData.value = null;
            studentRecord.value = null;
            userFeatures.value = [];
            activeSubscriptions.value = [];
            activeSubscription.value = null;
            return false;
        }
    };

    const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
        loading.value = true;
        error.value = null;
        requiresVerification.value = false;
        verificationData.value = null;

        try {
            const response = await authService.login(credentials);

            if (response.requires_verification) {
                requiresVerification.value = true;
                verificationData.value = {
                    user_id: response.user_id,
                    verification_domain: response.verification_domain,
                    user_profile_domain: response.user_profile_domain,
                    username: credentials.username,
                };
                return response;
            }

            user.value = {
                id: response.user_id,
                token: response.token,
                expiresAt: response.expires_at,
                username: response.username,
                email: response.email,
                lab_url: response.lab_url,
                first_name: response.first_name,
                last_name: response.last_name,
                image_url: response.image_url,
                is_email_verified: response.is_email_verified
            };
            token.value = response.token;
            isAuthenticated.value = true;
            authService.setUser(user.value);

            Promise.allSettled([
                checkProctorStatus(response.user_id),
                response.lab_url ? loadStudentRecord() : Promise.resolve(null),
                loadUserFeatures(),
                loadActiveSubscriptions()
            ]).catch(err => console.warn('Background checks failed:', err));

            userService.getUserProfile(response.user_id)
                .then(profile => {
                    if (user.value && user.value.id === response.user_id) {
                        user.value = {
                            ...user.value,
                            ...profile,
                            id: user.value.id,
                            token: user.value.token,
                            expiresAt: user.value.expiresAt,
                        };
                        authService.setUser(user.value);
                    }
                })
                .catch(err => console.warn('Background profile fetch failed (non-critical):', err));

            return response;
        } catch (err: any) {
            error.value = err?.message || 'Login failed';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const register = async (userData: UserProfile): Promise<RegisterResponse> => {
        loading.value = true;
        error.value = null;
        try {
            const response = await userService.register(userData);
            requiresVerification.value = true;
            verificationData.value = {
                user_id: response.user_id,
                username: response.username,
                email: userData.email,
            };
            return response;
        } catch (err: any) {
            error.value = err.message || 'Registration failed';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const generateOTP = async (data: OTPGenerationRequest): Promise<OTPResponse> => {
        loading.value = true;
        error.value = null;
        try {
            return await otpService.generateOTP(data);
        } catch (err: any) {
            error.value = err.message || 'Failed to generate OTP';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const verifyOTP = async (data: OTPVerificationRequest): Promise<OTPResponse> => {
        loading.value = true;
        error.value = null;
        try {
            const response = await otpService.verifyOTP(data);
            if (response.email_verified) {
                requiresVerification.value = false;
                verificationData.value = null;
            }
            return response;
        } catch (err: any) {
            error.value = err.message || 'Failed to verify OTP';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const resendOTP = async (data: OTPGenerationRequest): Promise<OTPResponse> => {
        loading.value = true;
        error.value = null;
        try {
            return await otpService.resendOTP(data);
        } catch (err: any) {
            error.value = err.message || 'Failed to resend OTP';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const verifyEmail = async (request: EmailVerificationRequest): Promise<any> => {
        loading.value = true;
        error.value = null;
        try {
            const response = await userService.verifyEmail(request);
            if (response.email_verified) {
                requiresVerification.value = false;
                verificationData.value = null;
            }
            return response;
        } catch (err: any) {
            error.value = err.message || 'Failed to verify email';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const logout = async (): Promise<void> => {
        const currentToken = token.value;
        const currentUserId = user.value?.id;

        user.value = null;
        token.value = null;
        isAuthenticated.value = false;
        requiresVerification.value = false;
        verificationData.value = null;
        isProctor.value = false;
        proctorData.value = null;
        studentRecord.value = null;
        userFeatures.value = [];
        activeSubscriptions.value = [];
        activeSubscription.value = null;
        subscriptionLoaded.value = false;
        authService.clearAuth();

        if (currentUserId) {
            subscriptionService.clearSelectedSubscriptionId(currentUserId);
        }

        if (currentToken) {
            authService.logout(currentToken).catch(err =>
                console.warn('Server logout failed (ignored):', err)
            );
        }
    };

    const checkUsername = async (username: string): Promise<CheckUsernameResponse> => {
        try {
            return await userService.checkUsername(username);
        } catch (err: any) {
            error.value = err.message || 'Failed to check username';
            throw err;
        }
    };

    const checkEmail = async (email: string): Promise<CheckEmailResponse> => {
        try {
            return await userService.checkEmail(email);
        } catch (err: any) {
            error.value = err.message || 'Failed to check email';
            throw err;
        }
    };

    const checkPassword = async (credentials: PasswordCheckRequest): Promise<PasswordCheckResponse> => {
        try {
            return await userService.checkPassword(credentials);
        } catch (err: any) {
            error.value = err.message || 'Failed to check password';
            throw err;
        }
    };

    const updateProfile = async (userId: string, updateData: UpdateProfileRequest): Promise<UserProfile> => {
        loading.value = true;
        error.value = null;
        try {
            const updatedProfile = await userService.updateUserProfile(userId, updateData);
            if (user.value && user.value.id === userId) {
                user.value = {
                    ...user.value,
                    ...updatedProfile,
                    username: updatedProfile.username || user.value.username,
                    email: updatedProfile.email || user.value.email,
                    lab_url: updatedProfile.lab_url || user.value.lab_url
                };
                authService.setUser(user.value);
            }
            return updatedProfile;
        } catch (err: any) {
            error.value = err.message || 'Failed to update profile';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const changePassword = async (userId: string, passwordData: ChangePasswordRequest): Promise<UserProfile> => {
        loading.value = true;
        error.value = null;
        try {
            const updatedProfile = await userService.changePassword(userId, passwordData);
            if (user.value && user.value.id === userId) {
                user.value = { ...user.value, ...updatedProfile };
            }
            return updatedProfile;
        } catch (err: any) {
            console.error('Change password error in store:', err);
            error.value = err.message || 'Failed to change password';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const uploadProfilePicture = async (userId: string, username: string, imageFile: File) => {
        loading.value = true;
        error.value = null;
        try {
            const response = await mediaService.uploadProfileImage(userId, username, imageFile);
            if (user.value && user.value.id === userId) {
                const profile = await userService.getUserProfile(userId);
                user.value.image_url = profile.image_url;
                authService.setUser(user.value);
            }
            return response;
        } catch (err: any) {
            error.value = err.message || 'Failed to upload profile picture';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const deleteProfilePicture = async (userId: string): Promise<UserProfile> => {
        loading.value = true;
        error.value = null;
        try {
            await mediaService.deleteProfileImage(userId);
            const updatedProfile = await userService.updateUserProfile(userId, { image_url: '' });
            if (user.value && user.value.id === userId) {
                user.value.image_url = '';
                authService.setUser(user.value);
            }
            return updatedProfile;
        } catch (err: any) {
            error.value = err.message || 'Failed to delete profile picture';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const getUserInitials = (firstName?: string, lastName?: string, username?: string): string => {
        if (firstName && lastName) return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        if (firstName) return firstName.charAt(0).toUpperCase();
        if (lastName) return lastName.charAt(0).toUpperCase();
        if (username) return username.charAt(0).toUpperCase();
        return 'U';
    };

    const getCurrentUserProfile = async (): Promise<UserProfile> => {
        if (!user.value?.id) throw new Error('User not authenticated');
        try {
            return await userService.getUserProfile(user.value.id);
        } catch (err: any) {
            error.value = err.message || 'Failed to get user profile';
            throw err;
        }
    };

    const clearError = (): void => {
        error.value = null;
    };

    const deleteAccount = async (password: string): Promise<void> => {
        loading.value = true;
        error.value = null;
        try {
            if (!user.value?.id || !user.value?.username) {
                throw new Error('User not authenticated');
            }
            await userService.deleteAccount(user.value.username.toLowerCase(), password);
            await logout();
        } catch (err: any) {
            error.value = err.message || 'Failed to delete account';
            throw err;
        } finally {
            loading.value = false;
        }
    };

    const searchUsers = async (searchTerm: string, limit: number = 10): Promise<UserProfile[]> => {
        try {
            return await userService.searchUsers(searchTerm, limit);
        } catch (err: any) {
            error.value = err.message || 'Failed to search users';
            throw err;
        }
    };

    const getAllUsernames = async (): Promise<string[]> => {
        try {
            return await userService.getAllUsernames();
        } catch (err: any) {
            error.value = err.message || 'Failed to get usernames';
            throw err;
        }
    };

    const getUserProfileByUsername = async (username: string): Promise<UserProfile> => {
        try {
            return await userService.getUserProfileByUsername(username);
        } catch (err: any) {
            error.value = err.message || 'Failed to get user profile';
            throw err;
        }
    };

    const hasLabAccess = computed(() => {
        return user.value?.lab_url && user.value.lab_url.trim() !== '' && userFeatures.value.includes('lab_feature');
    });

    const hasAiAccess = computed(() => userFeatures.value.includes('ai_feature'));
    const hasRunbookAccess = computed(() => userFeatures.value.includes('runbook_feature'));
    const hasExamFeature = computed(() => userFeatures.value.includes('exam_feature'));
    const hasResearchFlowAccess = computed(() => userFeatures.value.includes('research_flow_feature'));
    const hasToastmastersAccess = computed(() => userFeatures.value.includes('toastmasters_feature'));

    /**
     * True when the user has ANY active subscription.
     */
    const hasActiveSubscription = computed(() => {
        if (activeSubscriptions.value.length > 0) return true;
        if (activeSubscription.value) return true;
        if (userFeatures.value.length > 0) return true;
        return false;
    });

    const ensureStudentRecord = async (): Promise<Student | null> => {
        if (!hasLabAccess.value || !user.value?.username) return null;
        if (studentRecord.value) return studentRecord.value;
        return await loadStudentRecord();
    };

    return {
        user,
        token,
        isAuthenticated,
        loading,
        error,
        requiresVerification,
        verificationData,
        isProctor,
        proctorData,
        studentRecord,
        userFeatures,
        activeSubscription,
        activeSubscriptions,
        subscriptionLoaded,

        hasLabAccess,
        hasAiAccess,
        hasRunbookAccess,
        hasExamFeature,
        hasResearchFlowAccess,
        hasToastmastersAccess,
        hasActiveSubscription,

        initAuth,
        checkAuth,
        checkProctorStatus,
        login,
        register,
        generateOTP,
        verifyOTP,
        resendOTP,
        verifyEmail,
        logout,
        checkUsername,
        checkEmail,
        checkPassword,
        updateProfile,
        changePassword,
        uploadProfilePicture,
        deleteProfilePicture,
        getUserInitials,
        getCurrentUserProfile,
        clearError,
        deleteAccount,
        searchUsers,
        getAllUsernames,
        getUserProfileByUsername,
        loadStudentRecord,
        ensureStudentRecord,
        loadUserFeatures,
        loadActiveSubscription,
        loadActiveSubscriptions
    };
});