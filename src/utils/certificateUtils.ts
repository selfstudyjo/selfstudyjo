export function formatCertificateDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export function getCertificateStatus(expireDate: string): { status: 'valid' | 'expired' | 'expiring'; daysRemaining: number } {
    const today = new Date();
    const expire = new Date(expireDate);
    const daysRemaining = Math.ceil((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
        return { status: 'expired', daysRemaining: Math.abs(daysRemaining) };
    } else if (daysRemaining <= 30) {
        return { status: 'expiring', daysRemaining };
    } else {
        return { status: 'valid', daysRemaining };
    }
}

export function getUserInitials(firstName?: string, lastName?: string, username?: string): string {
    if (firstName && lastName) {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    } else if (firstName) {
        return firstName.charAt(0).toUpperCase();
    } else if (lastName) {
        return lastName.charAt(0).toUpperCase();
    } else if (username) {
        return username.substring(0, 2).toUpperCase();
    }
    return 'U';
}

export function getAvatarColor(userId: string): string {
    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
        'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)',
        'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
        'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)',
        'linear-gradient(135deg, #f56565 0%, #c53030 100%)',
        'linear-gradient(135deg, #38b2ac 0%, #319795 100%)',
        'linear-gradient(135deg, #ed64a6 0%, #d53f8c 100%)',
    ];

    // Create a simple hash from the user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
}
