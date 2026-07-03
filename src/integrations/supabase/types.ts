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
      feed_post_comments: {
        Row: {
          author_id: string
          author_name: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason?: string
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          author_id: string
          author_name: string
          body: string
          comic_pages: Json
          cover_image: string | null
          created_at: string
          hidden: boolean
          id: string
          image: string | null
          post_kind: string
          project_id: string | null
          title: string | null
          verified: boolean
          word_count: number
        }
        Insert: {
          author_id: string
          author_name: string
          body?: string
          comic_pages?: Json
          cover_image?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          image?: string | null
          post_kind?: string
          project_id?: string | null
          title?: string | null
          verified?: boolean
          word_count?: number
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          comic_pages?: Json
          cover_image?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          image?: string | null
          post_kind?: string
          project_id?: string | null
          title?: string | null
          verified?: boolean
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_characters: {
        Row: {
          backstory: string
          created_at: string
          id: string
          name: string
          notebook_id: string
          role: string
          traits: string
        }
        Insert: {
          backstory?: string
          created_at?: string
          id?: string
          name?: string
          notebook_id: string
          role?: string
          traits?: string
        }
        Update: {
          backstory?: string
          created_at?: string
          id?: string
          name?: string
          notebook_id?: string
          role?: string
          traits?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_characters_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_lore: {
        Row: {
          category: string
          created_at: string
          details: string
          id: string
          notebook_id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          notebook_id: string
          title?: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          notebook_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_lore_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_members: {
        Row: {
          can_edit: boolean
          created_at: string
          notebook_id: string
          user_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          notebook_id: string
          user_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          notebook_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_members_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          notebook_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          notebook_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          notebook_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_messages_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_timeline_events: {
        Row: {
          created_at: string
          description: string
          event_date: string
          event_order: number
          id: string
          notebook_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          event_date?: string
          event_order?: number
          id?: string
          notebook_id: string
          title?: string
        }
        Update: {
          created_at?: string
          description?: string
          event_date?: string
          event_order?: number
          id?: string
          notebook_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_timeline_events_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          body: string
          created_at: string
          id: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          owner_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_shadow_banned: boolean
          is_system_locked: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_shadow_banned?: boolean
          is_system_locked?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_shadow_banned?: boolean
          is_system_locked?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["report_kind"]
          reported_user_id: string | null
          reporter_id: string
          resolved: boolean
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["report_kind"]
          reported_user_id?: string | null
          reporter_id: string
          resolved?: boolean
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["report_kind"]
          reported_user_id?: string | null
          reporter_id?: string
          resolved?: boolean
          title?: string
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
      writer_chapters: {
        Row: {
          body: string
          created_at: string
          id: string
          owner_id: string
          position: number
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          owner_id: string
          position?: number
          project_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          position?: number
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "writer_chapters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "writer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      writer_characters: {
        Row: {
          backstory: string
          created_at: string
          id: string
          name: string
          owner_id: string
          project_id: string
          role: string
          traits: string
        }
        Insert: {
          backstory?: string
          created_at?: string
          id?: string
          name?: string
          owner_id: string
          project_id: string
          role?: string
          traits?: string
        }
        Update: {
          backstory?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          role?: string
          traits?: string
        }
        Relationships: [
          {
            foreignKeyName: "writer_characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "writer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      writer_feedback: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: []
      }
      writer_lore: {
        Row: {
          category: string
          created_at: string
          details: string
          id: string
          owner_id: string
          project_id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          owner_id: string
          project_id: string
          title?: string
        }
        Update: {
          category?: string
          created_at?: string
          details?: string
          id?: string
          owner_id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "writer_lore_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "writer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      writer_projects: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      writer_timeline_events: {
        Row: {
          created_at: string
          description: string
          event_date: string
          event_order: number
          id: string
          owner_id: string
          project_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          event_date?: string
          event_order?: number
          id?: string
          owner_id: string
          project_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          event_date?: string
          event_order?: number
          id?: string
          owner_id?: string
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "writer_timeline_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "writer_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_notebook: {
        Args: { _nb: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_notebook_member: {
        Args: { _nb: string; _uid: string }
        Returns: boolean
      }
      is_notebook_owner: {
        Args: { _nb: string; _uid: string }
        Returns: boolean
      }
      is_shadow_banned: { Args: { _uid: string }; Returns: boolean }
      is_system_locked: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      report_kind: "bug" | "feature" | "video" | "user"
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
      app_role: ["admin", "moderator", "user"],
      report_kind: ["bug", "feature", "video", "user"],
    },
  },
} as const
