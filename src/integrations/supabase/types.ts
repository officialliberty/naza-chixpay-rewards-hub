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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      balance_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chix_key_requests: {
        Row: {
          amount: number
          chix_id: string | null
          created_at: string
          full_name: string | null
          id: string
          plan_name: string
          receipt_path: string | null
          reviewed_at: string | null
          status: string
          user_id: string
          uses_total: number | null
        }
        Insert: {
          amount: number
          chix_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          plan_name: string
          receipt_path?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
          uses_total?: number | null
        }
        Update: {
          amount?: number
          chix_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          plan_name?: string
          receipt_path?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
          uses_total?: number | null
        }
        Relationships: []
      }
      chix_keys: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          unlimited: boolean
          updated_at: string
          user_id: string
          uses_left: number | null
          uses_total: number | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          unlimited?: boolean
          updated_at?: string
          user_id: string
          uses_left?: number | null
          uses_total?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          unlimited?: boolean
          updated_at?: string
          user_id?: string
          uses_left?: number | null
          uses_total?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          phone: string
          referral_code: string | null
          referred_by: string | null
          restricted_at: string | null
          restriction_reason: string | null
          state: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name: string
          id: string
          phone: string
          referral_code?: string | null
          referred_by?: string | null
          restricted_at?: string | null
          restriction_reason?: string | null
          state: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          referral_code?: string | null
          referred_by?: string | null
          restricted_at?: string | null
          restriction_reason?: string | null
          state?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          amount: number
          created_at: string
          id: string
          referred_id: string
          referred_name: string
          referrer_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          referred_id: string
          referred_name?: string
          referrer_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          referred_id?: string
          referred_name?: string
          referrer_id?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          amount: number
          created_at: string
          id: string
          task_day: string
          task_key: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          task_day?: string
          task_key: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          task_day?: string
          task_key?: string
          user_id?: string
        }
        Relationships: []
      }
      upgrade_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          plan_name: string
          receipt_path: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          plan_name: string
          receipt_path?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          plan_name?: string
          receipt_path?: string | null
          status?: string
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
      withdrawal_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          plan_name: string | null
          receipt_path: string | null
          reviewed_at: string | null
          status: string
          user_id: string
          withdrawal_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          plan_name?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
          withdrawal_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          plan_name?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_payments_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          account_number: string
          amount: number
          bank_name: string
          created_at: string
          full_name: string
          id: string
          stage: string
          status: string
          user_id: string
        }
        Insert: {
          account_number: string
          amount: number
          bank_name: string
          created_at?: string
          full_name: string
          id?: string
          stage?: string
          status?: string
          user_id: string
        }
        Update: {
          account_number?: string
          amount?: number
          bank_name?: string
          created_at?: string
          full_name?: string
          id?: string
          stage?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: { _amount: number; _reason?: string; _user_id: string }
        Returns: boolean
      }
      admin_list_balances: {
        Args: never
        Returns: {
          adjustments: number
          balance: number
          user_id: string
        }[]
      }
      admin_list_chix_requests: {
        Args: never
        Returns: {
          amount: number
          chix_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          plan_name: string
          receipt_path: string
          status: string
          user_id: string
          uses_total: number
        }[]
      }
      admin_list_upgrade_requests: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          email: string
          full_name: string
          id: string
          plan_name: string
          receipt_path: string
          status: string
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          pending_upgrades: number
          phone: string
          referral_code: string
          referral_count: number
          restriction_reason: string
          state: string
          status: string
          upgrade_count: number
        }[]
      }
      admin_list_withdrawal_payments: {
        Args: { _kind: string }
        Returns: {
          account_number: string
          amount: number
          bank_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          kind: string
          plan_name: string
          receipt_path: string
          stage: string
          status: string
          user_id: string
          withdraw_amount: number
          withdrawal_id: string
        }[]
      }
      admin_revoke_chix_key: { Args: { _user_id: string }; Returns: boolean }
      admin_send_notification: {
        Args: { _body: string; _title: string; _user_id: string }
        Returns: boolean
      }
      admin_set_account_status: {
        Args: { _reason?: string; _status: string; _user_id: string }
        Returns: boolean
      }
      admin_set_chix_request_status: {
        Args: { _request_id: string; _status: string }
        Returns: boolean
      }
      admin_set_setting: {
        Args: { _key: string; _value: string }
        Returns: boolean
      }
      admin_set_upgrade_status: {
        Args: { _request_id: string; _status: string }
        Returns: boolean
      }
      admin_set_withdrawal_payment_status: {
        Args: { _payment_id: string; _status: string }
        Returns: boolean
      }
      claim_admin: { Args: never; Returns: boolean }
      ensure_profile: {
        Args: { _full_name?: string; _phone?: string; _state?: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_user: {
        Args: {
          _body: string
          _kind?: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      redeem_referral: { Args: { _code: string; _name: string }; Returns: Json }
      request_withdrawal: {
        Args: {
          _account: string
          _amount: number
          _bank: string
          _code: string
          _full_name: string
        }
        Returns: Json
      }
      settle_direct_withdrawals: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
