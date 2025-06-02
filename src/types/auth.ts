import type { User } from '@supabase/supabase-js';

export interface UserProfile extends User {
    id: string;
    email?: string;
    last_sign_in_at?: string | null; // Added to ensure the property exists on UserProfile
    user_metadata: {
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
    };
}

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