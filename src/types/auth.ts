import type { AuthUser as SupabaseAuthUser, AuthUserIdentity as SupabaseUserIdentity } from '@supabase/supabase-js';

// Define the custom part of user_metadata for clarity and strong typing
export interface CustomUserMetadata {
    display_name?: string;
    user_viht_id?: string;
    client_key?: string;
    ai_requests_made?: number;
    ai_requests_limit?: number;
    is_premium?: boolean;
    premium_expires_at?: string | null;
    last_request_reset_at?: string | null;
    support_tickets_created?: number;
    activity_points?: number;
    completed_secret_achievements?: string[];
    awarded_achievement_points_log?: Record<string, boolean>; // Tracks if points for an achievement_id have been awarded
    daily_task_progress?: Array<{ // Tracks progress for daily tasks
        task_id: string;
        current_value: number;
        completed_today: boolean; // Task goal met for the day
        claimed_today: boolean;   // Points for this task claimed for theday
        last_progress_date: string; // YYYY-MM-DD format
        ai_generated_name?: string; // AI-generated name for the task
        ai_generated_description?: string; // AI-generated description
        ai_generated_points?: number; // AI-generated points for the task
        is_ai_refreshed?: boolean; // True if AI refreshed this task's content
        claimed_at_timestamp?: number; // Timestamp when the task reward was claimed (Date.now())
    }>;
    terms_agreed_at?: string | null; // Added for legal agreement
    [key: string]: any;
}

// UserProfile now extends SupabaseAuthUser but overrides user_metadata with our custom type.
// It inherits id, email, app_metadata, identities, etc., from SupabaseAuthUser.
export interface UserProfile extends Omit<SupabaseAuthUser, 'user_metadata'> {
  user_metadata: CustomUserMetadata;
  // SupabaseAuthUser.email is string | undefined.
  // If your application logic ensures email is always present for a UserProfile,
  // you could declare `email: string;` here. For now, it inherits the optionality.
}

// Export UserIdentity aliased for consistency if used elsewhere.
export type UserIdentity = SupabaseUserIdentity;


// Placeholder type for the user data admin will see/edit in AdminUsersSection
export interface SearchedUserAdminView extends UserProfile {
    // Potentially add more fields here if needed for admin view
}

export interface TopUser {
  rank: number;
  display_name: string;
  activity_points: number; // Changed from ai_requests_made
  user_viht_id?: string;    // Added for highlighting current user
}