// types/chat.ts
export interface ChatRoom {
    id: number;
    anonymous_user_ip: string;
    created_at: string;
    last_active: string;
}

export interface ChatMessage {
    id: number;
    sender: 'anonymous' | 'admin' | 'system';
    message: string;
    timestamp: string;
    is_seen: boolean;
    is_unread?: boolean;
}

export interface Replica {
    url: string;
    is_active: boolean;
    last_checked: Date;
}

export interface ChatState {
    isOpen: boolean;
    isMinimized: boolean;
    isLoading: boolean;
    isConnected: boolean;
    userIP: string;
    currentRoom: ChatRoom | null;
    currentReplica: Replica | null;
    messages: ChatMessage[];
    unreadCount: number;
    lastSeenMessageId: number | null;
    error: string | null;
}
