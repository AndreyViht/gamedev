
export interface AdminSupportTicket {
    id: string; // UUID
    user_id: string; // UUID, references auth.users(id)
    user_viht_id?: string | null;
    user_display_name?: string | null;
    status: 'open' | 'pending_admin' | 'pending_user' | 'closed';
    subject?: string | null;
    created_at: string; // timestamptz
    updated_at: string; // timestamptz
    last_message_at?: string | null; // timestamptz
    last_message_sender_role?: 'user' | 'admin' | null;
    last_message_snippet?: string | null;
    admin_has_unread: boolean;
    user_has_unread: boolean;
}

export interface AdminChatMessage {
    id: string; // UUID
    ticket_id: string; // UUID, references admin_support_tickets(id)
    sender_id: string; // UUID (user_id for user, potentially a fixed admin ID or user_id of admin)
    sender_role: 'user' | 'admin';
    message_text?: string | null;
    // attachment_url?: string | null; // Removed
    // attachment_name?: string | null; // Removed
    // attachment_type?: string | null; // Removed
    created_at: string; // timestamptz
}