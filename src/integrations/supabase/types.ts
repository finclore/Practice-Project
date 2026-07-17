export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          client_code: string
          created_at: string
          created_by: string | null
          display_name: string
          firm_id: string
          id: string
          legal_name: string | null
          notes: string | null
          primary_contact_email: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_code: string
          created_at?: string
          created_by?: string | null
          display_name: string
          firm_id: string
          id?: string
          legal_name?: string | null
          notes?: string | null
          primary_contact_email?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_code?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          firm_id?: string
          id?: string
          legal_name?: string | null
          notes?: string | null
          primary_contact_email?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          engagement_reference: string
          firm_id: string
          id: string
          name: string
          owner_user_id: string | null
          service_id: string
          start_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          engagement_reference: string
          firm_id: string
          id?: string
          name: string
          owner_user_id?: string | null
          service_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          engagement_reference?: string
          firm_id?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          service_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagements_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_branding: {
        Row: {
          accent_color_hex: string | null
          brand_display_name: string
          branding_name: string
          created_at: string
          default_font_family: string
          default_footer_text: string | null
          default_reply_to_email: string | null
          default_signatory_name: string | null
          default_signatory_title: string | null
          firm_id: string
          id: string
          primary_color_hex: string
          primary_logo_path: string | null
          secondary_color_hex: string
          status: string
          tagline: string | null
          updated_at: string
          version_number: number
        }
        Insert: {
          accent_color_hex?: string | null
          brand_display_name: string
          branding_name: string
          created_at?: string
          default_font_family?: string
          default_footer_text?: string | null
          default_reply_to_email?: string | null
          default_signatory_name?: string | null
          default_signatory_title?: string | null
          firm_id: string
          id?: string
          primary_color_hex?: string
          primary_logo_path?: string | null
          secondary_color_hex?: string
          status?: string
          tagline?: string | null
          updated_at?: string
          version_number?: number
        }
        Update: {
          accent_color_hex?: string | null
          brand_display_name?: string
          branding_name?: string
          created_at?: string
          default_font_family?: string
          default_footer_text?: string | null
          default_reply_to_email?: string | null
          default_signatory_name?: string | null
          default_signatory_title?: string | null
          firm_id?: string
          id?: string
          primary_color_hex?: string
          primary_logo_path?: string | null
          secondary_color_hex?: string
          status?: string
          tagline?: string | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "firm_branding_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_memberships: {
        Row: {
          access_end_date: string | null
          access_start_date: string
          created_at: string
          firm_id: string
          id: string
          is_primary_firm: boolean
          reports_to_user_id: string | null
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_end_date?: string | null
          access_start_date?: string
          created_at?: string
          firm_id: string
          id?: string
          is_primary_firm?: boolean
          reports_to_user_id?: string | null
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_end_date?: string | null
          access_start_date?: string
          created_at?: string
          firm_id?: string
          id?: string
          is_primary_firm?: boolean
          reports_to_user_id?: string | null
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_memberships_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firm_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          country_code: string
          created_at: string
          date_format: string
          default_currency: string
          default_sender_email: string | null
          default_sender_name: string | null
          display_name: string
          firm_code: string
          general_email: string | null
          id: string
          legal_name: string
          primary_state_code: string | null
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          date_format?: string
          default_currency?: string
          default_sender_email?: string | null
          default_sender_name?: string | null
          display_name: string
          firm_code: string
          general_email?: string | null
          id?: string
          legal_name: string
          primary_state_code?: string | null
          status: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          date_format?: string
          default_currency?: string
          default_sender_email?: string | null
          default_sender_name?: string | null
          display_name?: string
          firm_code?: string
          general_email?: string | null
          id?: string
          legal_name?: string
          primary_state_code?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          first_name: string | null
          job_title: string | null
          last_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          first_name?: string | null
          job_title?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          first_name?: string | null
          job_title?: string | null
          last_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          role_level: number
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          role_level: number
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          role_level?: number
          status?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          firm_id: string
          id: string
          name: string
          service_code: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          firm_id: string
          id?: string
          name: string
          service_code: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          firm_id?: string
          id?: string
          name?: string
          service_code?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_client: { Args: { _client_id: string }; Returns: undefined }
      archive_service: { Args: { _service_id: string }; Returns: undefined }
      bootstrap_first_admin: {
        Args: { _firm_code: string; _user_email: string }
        Returns: string
      }
      create_client: {
        Args: {
          _client_code: string
          _display_name: string
          _firm_id: string
          _legal_name?: string
          _notes?: string
          _primary_contact_email?: string
          _status?: string
        }
        Returns: string
      }
      create_service: {
        Args: {
          _description?: string
          _firm_id: string
          _name: string
          _service_code: string
        }
        Returns: string
      }
      has_firm_role: {
        Args: { _firm_id: string; _role_codes: string[] }
        Returns: boolean
      }
      update_client: {
        Args: {
          _client_id: string
          _display_name?: string
          _legal_name?: string
          _notes?: string
          _primary_contact_email?: string
          _status?: string
        }
        Returns: undefined
      }
      update_service: {
        Args: {
          _description?: string
          _name?: string
          _service_id: string
          _status?: string
        }
        Returns: undefined
      }
      user_active_role_id: { Args: never; Returns: string }
      user_has_active_firm: { Args: { _firm_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
