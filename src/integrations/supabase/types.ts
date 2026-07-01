export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      customers: {
        Row: {
          address: string;
          created_at: string;
          empty_bottles: number;
          id: string;
          name: string;
          phone: string | null;
          price_per_bottle: number;
          route: "A" | "B";
        };
        Insert: {
          address?: string;
          created_at?: string;
          empty_bottles?: number;
          id?: string;
          name: string;
          phone?: string | null;
          price_per_bottle?: number;
          route?: "A" | "B";
        };
        Update: {
          address?: string;
          created_at?: string;
          empty_bottles?: number;
          id?: string;
          name?: string;
          phone?: string | null;
          price_per_bottle?: number;
          route?: "A" | "B";
        };
        Relationships: [];
      };
      deliveries: {
        Row: {
          bottles_delivered: number;
          created_at: string;
          customer_id: string | null;
          customer_type: Database["public"]["Enums"]["customer_type"];
          id: string;
          lot_id: string;
          payment_mode: Database["public"]["Enums"]["payment_mode"];
          price_per_bottle: number;
          total_amount: number;
          worker_id: string;
        };
        Insert: {
          bottles_delivered: number;
          created_at?: string;
          customer_id?: string | null;
          customer_type: Database["public"]["Enums"]["customer_type"];
          id?: string;
          lot_id: string;
          payment_mode: Database["public"]["Enums"]["payment_mode"];
          price_per_bottle: number;
          total_amount: number;
          worker_id: string;
        };
        Update: {
          bottles_delivered?: number;
          created_at?: string;
          customer_id?: string | null;
          customer_type?: Database["public"]["Enums"]["customer_type"];
          id?: string;
          lot_id?: string;
          payment_mode?: Database["public"]["Enums"]["payment_mode"];
          price_per_bottle?: number;
          total_amount?: number;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliveries_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deliveries_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          name: string;
          worker_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          name: string;
          worker_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          name?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      lots: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["lot_status"];
          total_bottles: number;
          worker_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["lot_status"];
          total_bottles: number;
          worker_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["lot_status"];
          total_bottles?: number;
          worker_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          kind: string;
          message: string;
          user_id: string | null;
          worker_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          kind: string;
          message: string;
          user_id?: string | null;
          worker_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          kind?: string;
          message?: string;
          user_id?: string | null;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          customer_id: string;
          id: string;
          payment_mode: Database["public"]["Enums"]["payment_mode"];
          recorded_by: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          customer_id: string;
          id?: string;
          payment_mode: Database["public"]["Enums"]["payment_mode"];
          recorded_by: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          customer_id?: string;
          id?: string;
          payment_mode?: Database["public"]["Enums"]["payment_mode"];
          recorded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id: string;
          name?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "worker";
      customer_type: "walkin" | "regular";
      lot_status: "active" | "completed";
      payment_mode: "cash" | "card" | "online" | "pending";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "worker"],
      customer_type: ["walkin", "regular"],
      lot_status: ["active", "completed"],
      payment_mode: ["cash", "card", "online", "pending"],
    },
  },
} as const;
