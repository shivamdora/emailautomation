export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          target_id: string | null;
          target_type: string | null;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["activity_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["activity_logs"]["Insert"]>;
      };
      campaign_contacts: {
        Row: {
          campaign_id: string;
          contact_id: string;
          created_at: string;
          current_step: number;
          error_message: string | null;
          failed_attempts: number;
          id: string;
          last_message_id: string | null;
          last_thread_id: string | null;
          last_synced_at: string | null;
          next_due_at: string | null;
          replied_at: string | null;
          status:
            | "queued"
            | "sent"
            | "followup_due"
            | "followup_sent"
            | "replied"
            | "unsubscribed"
            | "failed"
            | "skipped";
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["campaign_contacts"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["campaign_contacts"]["Insert"]>;
      };
      campaign_steps: {
        Row: {
          body_template: string;
          campaign_id: string;
          created_at: string;
          id: string;
          step_number: number;
          step_type: "initial" | "follow_up";
          subject_template: string;
          wait_days: number;
        };
        Insert: Omit<Database["public"]["Tables"]["campaign_steps"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["campaign_steps"]["Insert"]>;
      };
      campaigns: {
        Row: {
          allowed_send_days: string[] | null;
          created_at: string;
          daily_send_limit: number;
          gmail_account_id: string;
          id: string;
          name: string;
          owner_user_id: string;
          send_window_end: string;
          send_window_start: string;
          status: "draft" | "active" | "paused" | "completed";
          timezone: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["campaigns"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
      };
      contacts: {
        Row: {
          company: string | null;
          created_at: string;
          custom_fields_jsonb: Json | null;
          email: string;
          external_contact_id: string | null;
          external_source: string | null;
          first_name: string | null;
          id: string;
          job_title: string | null;
          last_name: string | null;
          owner_user_id: string;
          source: string | null;
          unsubscribed_at: string | null;
          updated_at: string;
          website: string | null;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contacts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
      };
      feature_flags: {
        Row: {
          created_at: string;
          enabled: boolean;
          flag_key: string;
          id: string;
          workspace_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["feature_flags"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Insert"]>;
      };
      gmail_accounts: {
        Row: {
          created_at: string;
          daily_send_count: number;
          email_address: string;
          health_status: "active" | "needs_reauth" | "disconnected";
          id: string;
          last_history_id: string | null;
          last_synced_at: string | null;
          oauth_connection_id: string;
          status: "active" | "paused" | "error";
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["gmail_accounts"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["gmail_accounts"]["Insert"]>;
      };
      imports: {
        Row: {
          created_at: string;
          file_name: string | null;
          id: string;
          imported_count: number;
          owner_user_id: string;
          source_type: "csv" | "xlsx" | "google_sheets" | "custom_crm";
          status: "uploaded" | "mapped" | "processed" | "failed";
          storage_path: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["imports"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["imports"]["Insert"]>;
      };
      import_rows: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          import_id: string;
          mapped_payload: Json | null;
          raw_payload: Json;
          row_number: number;
          status: "pending" | "imported" | "failed" | "skipped";
        };
        Insert: Omit<Database["public"]["Tables"]["import_rows"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["import_rows"]["Insert"]>;
      };
      message_threads: {
        Row: {
          campaign_contact_id: string | null;
          created_at: string;
          gmail_thread_id: string;
          id: string;
          latest_message_at: string | null;
          snippet: string | null;
          subject: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["message_threads"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["message_threads"]["Insert"]>;
      };
      oauth_connections: {
        Row: {
          access_token_encrypted: string | null;
          created_at: string;
          email_address: string | null;
          id: string;
          provider: string;
          refresh_token_encrypted: string | null;
          scopes: string[] | null;
          status: "active" | "expired" | "revoked";
          token_expiry: string | null;
          updated_at: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["oauth_connections"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["oauth_connections"]["Insert"]>;
      };
      outbound_messages: {
        Row: {
          campaign_contact_id: string;
          created_at: string;
          error_message: string | null;
          gmail_message_id: string | null;
          gmail_thread_id: string | null;
          id: string;
          sent_at: string | null;
          status: "queued" | "sent" | "failed";
          step_number: number;
        };
        Insert: Omit<Database["public"]["Tables"]["outbound_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["outbound_messages"]["Insert"]>;
      };
      plan_limits: {
        Row: {
          active_campaigns_limit: number;
          connected_mailboxes_limit: number;
          created_at: string;
          crm_sync_enabled: boolean;
          daily_sends_limit: number;
          id: string;
          plan_key: string;
          seats_limit: number;
        };
        Insert: Omit<Database["public"]["Tables"]["plan_limits"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["plan_limits"]["Insert"]>;
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          onboarding_completed_at: string | null;
          primary_workspace_id: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["profiles"]["Row"],
          "created_at" | "updated_at" | "onboarding_completed_at"
        > & {
          onboarding_completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      templates: {
        Row: {
          body_template: string;
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          subject_template: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["templates"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
      };
      thread_messages: {
        Row: {
          body_html: string | null;
          body_text: string | null;
          created_at: string;
          direction: "outbound" | "inbound";
          from_email: string | null;
          gmail_message_id: string;
          gmail_thread_id: string;
          headers_jsonb: Json | null;
          id: string;
          sent_at: string;
          snippet: string | null;
          subject: string | null;
          to_emails: string[] | null;
        };
        Insert: Omit<Database["public"]["Tables"]["thread_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["thread_messages"]["Insert"]>;
      };
      unsubscribes: {
        Row: {
          contact_id: string;
          created_at: string;
          email: string;
          id: string;
          reason: string | null;
          token_hash: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["unsubscribes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["unsubscribes"]["Insert"]>;
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: "owner" | "admin" | "member";
          user_id: string;
          workspace_id: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workspace_members"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workspaces"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
      };
      workspace_usage_counters: {
        Row: {
          active_campaigns_count: number;
          connected_mailboxes_count: number;
          created_at: string;
          daily_sends_used: number;
          id: string;
          period_start: string;
          seats_used: number;
          updated_at: string;
          workspace_id: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["workspace_usage_counters"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["workspace_usage_counters"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
