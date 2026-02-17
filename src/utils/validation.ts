export const validateEmail = (email: string): string => {
    if (!email) return 'Email is required';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
    }

    return '';
};

export const validateUsername = (username: string): string => {
    if (!username) return 'Username is required';

    if (username.length < 3) {
        return 'Username must be at least 3 characters long';
    }

    if (username.length > 150) {
        return 'Username must be less than 150 characters';
    }

    const usernameRegex = /^[a-zA-Z0-9@/./+/-/_]+$/;
    if (!usernameRegex.test(username)) {
        return 'Username can only contain letters, digits and @/./+/-/_';
    }

    return '';
};

export const validatePassword = (password: string, fieldName: string = 'Password'): string => {
    if (!password) return `${fieldName} is required`;

    if (password.length < 8) {
        return `${fieldName} must be at least 8 characters long`;
    }

    return '';
};

export const validateConfirmPassword = (password: string, confirmPassword: string): string => {
    if (!confirmPassword) return 'Please confirm your password';

    if (password !== confirmPassword) {
        return 'Passwords do not match';
    }

    return '';
};

export const validateFirstName = (firstName: string): string => {
    if (firstName && firstName.length > 30) {
        return 'First name must be less than 30 characters';
    }

    return '';
};

export const validateLastName = (lastName: string): string => {
    if (lastName && lastName.length > 150) {
        return 'Last name must be less than 150 characters';
    }

    return '';
};

export const validateGender = (gender: string): string => {
    if (gender && !['M', 'F'].includes(gender)) {
        return 'Invalid gender selection';
    }

    return '';
};
