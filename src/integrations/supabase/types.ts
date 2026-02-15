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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      capacity_settings: {
        Row: {
          created_at: string
          id: string
          max_guests_per_slot: number
          max_tables_per_slot: number
          slot_duration_minutes: number
          total_restaurant_capacity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_guests_per_slot?: number
          max_tables_per_slot?: number
          slot_duration_minutes?: number
          total_restaurant_capacity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_guests_per_slot?: number
          max_tables_per_slot?: number
          slot_duration_minutes?: number
          total_restaurant_capacity?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      daily_free_tables: {
        Row: {
          created_at: string
          date: string
          dinner_free_tables: string
          id: string
          lunch_free_tables: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          date: string
          dinner_free_tables?: string
          id?: string
          lunch_free_tables?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          dinner_free_tables?: string
          id?: string
          lunch_free_tables?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reservation_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reservation_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reservation_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_hours: {
        Row: {
          created_at: string
          day_of_week: number
          dinner_end: string | null
          dinner_start: string | null
          id: string
          is_closed: boolean
          lunch_end: string | null
          lunch_start: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          dinner_end?: string | null
          dinner_start?: string | null
          id?: string
          is_closed?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          dinner_end?: string | null
          dinner_start?: string | null
          id?: string
          is_closed?: boolean
          lunch_end?: string | null
          lunch_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservation_tables: {
        Row: {
          created_at: string
          id: string
          reservation_id: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reservation_id: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reservation_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_tables_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_tables_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          assigned_table_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          dining_status: Database["public"]["Enums"]["dining_status"]
          guests: number
          id: string
          notes: string | null
          reservation_date: string
          reservation_end_time: string | null
          reservation_time: string
          source: string
          special_requests: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_table_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          dining_status?: Database["public"]["Enums"]["dining_status"]
          guests: number
          id?: string
          notes?: string | null
          reservation_date: string
          reservation_end_time?: string | null
          reservation_time: string
          source: string
          special_requests?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_table_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dining_status?: Database["public"]["Enums"]["dining_status"]
          guests?: number
          id?: string
          notes?: string | null
          reservation_date?: string
          reservation_end_time?: string | null
          reservation_time?: string
          source?: string
          special_requests?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_assigned_table_id_fkey"
            columns: ["assigned_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          seats: number
          table_number: string
          zone: Database["public"]["Enums"]["table_zone"]
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          seats?: number
          table_number: string
          zone?: Database["public"]["Enums"]["table_zone"]
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          seats?: number
          table_number?: string
          zone?: Database["public"]["Enums"]["table_zone"]
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          sound_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          sound_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          sound_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_available_tables: {
        Args: {
          _date: string
          _end_time: string
          _min_capacity?: number
          _start_time: string
          _zone?: Database["public"]["Enums"]["table_zone"]
        }
        Returns: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          seats: number
          table_number: string
          zone: Database["public"]["Enums"]["table_zone"]
        }[]
        SetofOptions: {
          from: "*"
          to: "tables"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_table_conflict: {
        Args: {
          _date: string
          _end_time: string
          _exclude_reservation_id?: string
          _start_time: string
          _table_id: string
        }
        Returns: {
          customer_name: string
          end_time: string
          reservation_id: string
          start_time: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_table_available: {
        Args: {
          _date: string
          _end_time: string
          _exclude_reservation_id?: string
          _start_time: string
          _table_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
      dining_status:
        | "pending"
        | "reserved"
        | "seated"
        | "completed"
        | "cancelled"
        | "no_show"
      table_zone: "inside" | "garden" | "room" | "mezz"
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
    Enums: {
      app_role: ["admin", "staff"],
      dining_status: [
        "pending",
        "reserved",
        "seated",
        "completed",
        "cancelled",
        "no_show",
      ],
      table_zone: ["inside", "garden", "room", "mezz"],
    },
  },
} as const
