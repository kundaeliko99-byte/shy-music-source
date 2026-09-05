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
      albums: {
        Row: {
          ai_tool: Database["public"]["Enums"]["ai_tool"] | null
          album_type: string
          artist_id: string
          artwork_shape: Database["public"]["Enums"]["artwork_shape"]
          cover_url: string | null
          created_at: string
          id: string
          producer: string | null
          release_date: string
          release_type: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_tool?: Database["public"]["Enums"]["ai_tool"] | null
          album_type?: string
          artist_id: string
          artwork_shape?: Database["public"]["Enums"]["artwork_shape"]
          cover_url?: string | null
          created_at?: string
          id?: string
          producer?: string | null
          release_date?: string
          release_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_tool?: Database["public"]["Enums"]["ai_tool"] | null
          album_type?: string
          artist_id?: string
          artwork_shape?: Database["public"]["Enums"]["artwork_shape"]
          cover_url?: string | null
          created_at?: string
          id?: string
          producer?: string | null
          release_date?: string
          release_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "albums_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          ai_tools_used: Database["public"]["Enums"]["ai_tool"][] | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          contact_email: string | null
          country: string | null
          created_at: string
          display_name: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          mobile_money_network: string | null
          mobile_money_number: string | null
          monthly_listeners: number
          slug: string
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          verified: boolean
          youtube_url: string | null
        }
        Insert: {
          ai_tools_used?: Database["public"]["Enums"]["ai_tool"][] | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          display_name: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          mobile_money_network?: string | null
          mobile_money_number?: string | null
          monthly_listeners?: number
          slug: string
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
          youtube_url?: string | null
        }
        Update: {
          ai_tools_used?: Database["public"]["Enums"]["ai_tool"][] | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          display_name?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          mobile_money_network?: string | null
          mobile_money_number?: string | null
          monthly_listeners?: number
          slug?: string
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
          youtube_url?: string | null
        }
        Relationships: []
      }
      downloads: {
        Row: {
          created_at: string
          id: string
          session_id: string | null
          track_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          session_id?: string | null
          track_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string | null
          track_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          artist_id: string
          created_at: string
          follower_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          follower_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_history: {
        Row: {
          id: string
          played_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_history_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      motivations: {
        Row: {
          artist_id: string
          created_at: string
          fan_id: string | null
          id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          fan_id?: string | null
          id?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          fan_id?: string | null
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          founding_artist_cap: number
          id: number
          updated_at: string
        }
        Insert: {
          founding_artist_cap?: number
          id?: number
          updated_at?: string
        }
        Update: {
          founding_artist_cap?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      playlist_tracks: {
        Row: {
          added_at: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          added_at?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_editorial: boolean
          is_public: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_editorial?: boolean
          is_public?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_editorial?: boolean
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plays: {
        Row: {
          country: string | null
          id: string
          played_at: string
          track_id: string
          user_id: string | null
        }
        Insert: {
          country?: string | null
          id?: string
          played_at?: string
          track_id: string
          user_id?: string | null
        }
        Update: {
          country?: string | null
          id?: string
          played_at?: string
          track_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plays_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      radio_sessions: {
        Row: {
          id: string
          mood_or_genre: string
          songs_played: string[]
          started_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          mood_or_genre: string
          songs_played?: string[]
          started_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          mood_or_genre?: string
          songs_played?: string[]
          started_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      saved_albums: {
        Row: {
          album_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_albums_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_applications: {
        Row: {
          amount_zmw: number
          artist_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          mobile_money_number: string
          network: Database["public"]["Enums"]["mobile_money_network"]
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          submitted_at: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_zmw: number
          artist_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          mobile_money_number: string
          network: Database["public"]["Enums"]["mobile_money_network"]
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          submitted_at?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_zmw?: number
          artist_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          mobile_money_number?: string
          network?: Database["public"]["Enums"]["mobile_money_network"]
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          submitted_at?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_applications_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_applications_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_founding: boolean
          name: string
          period: Database["public"]["Enums"]["subscription_period"]
          price_zmw: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_founding?: boolean
          name: string
          period?: Database["public"]["Enums"]["subscription_period"]
          price_zmw?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_founding?: boolean
          name?: string
          period?: Database["public"]["Enums"]["subscription_period"]
          price_zmw?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          application_id: string | null
          artist_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_founding: boolean
          plan_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          artist_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_founding?: boolean
          plan_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          artist_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_founding?: boolean
          plan_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "subscription_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          ai_tool: Database["public"]["Enums"]["ai_tool"]
          album_id: string | null
          artist_id: string
          artwork_shape: Database["public"]["Enums"]["artwork_shape"]
          audio_url: string
          cover_url: string | null
          created_at: string
          duration_seconds: number
          explicit: boolean
          genre: Database["public"]["Enums"]["genre"]
          id: string
          lyrics: string | null
          mood: Database["public"]["Enums"]["mood"] | null
          plays_count: number
          position_in_album: number | null
          release_date: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_tool: Database["public"]["Enums"]["ai_tool"]
          album_id?: string | null
          artist_id: string
          artwork_shape?: Database["public"]["Enums"]["artwork_shape"]
          audio_url: string
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          explicit?: boolean
          genre: Database["public"]["Enums"]["genre"]
          id?: string
          lyrics?: string | null
          mood?: Database["public"]["Enums"]["mood"] | null
          plays_count?: number
          position_in_album?: number | null
          release_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_tool?: Database["public"]["Enums"]["ai_tool"]
          album_id?: string | null
          artist_id?: string
          artwork_shape?: Database["public"]["Enums"]["artwork_shape"]
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number
          explicit?: boolean
          genre?: Database["public"]["Enums"]["genre"]
          id?: string
          lyrics?: string | null
          mood?: Database["public"]["Enums"]["mood"] | null
          plays_count?: number
          position_in_album?: number | null
          release_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ai_tool: "suno" | "udio" | "stable_audio" | "custom_model" | "other"
      app_role: "listener" | "artist" | "admin"
      artwork_shape: "circle" | "rounded" | "diamond" | "hexagon"
      genre:
        | "ambient"
        | "electronic"
        | "hiphop"
        | "afrobeats"
        | "classical"
        | "pop"
        | "lofi"
        | "experimental"
        | "cinematic"
        | "world"
        | "kalindula"
        | "traditional"
        | "zed_hiphop"
        | "dancehall"
        | "amapiano"
        | "afrobeat"
        | "afropop"
        | "rnb"
        | "gospel"
        | "folk"
        | "zamrock"
        | "kalindula_modern"
        | "zed_gospel"
        | "zed_rnb"
        | "zed_dancehall"
        | "kwaito"
        | "gqom"
        | "bongo_flava"
        | "genge"
        | "gengetone"
        | "benga"
        | "taarab"
        | "soukous"
        | "rumba"
        | "ndombolo"
        | "highlife"
        | "afroswing"
        | "afrohouse"
        | "afrofusion"
        | "afrosoul"
        | "afro_trap"
        | "naija_pop"
        | "juju"
        | "fuji"
        | "mbalax"
        | "coupe_decale"
        | "makossa"
        | "bikutsi"
        | "chimurenga"
        | "sungura"
        | "maskandi"
        | "mbaqanga"
        | "shangaan_electro"
        | "ethio_jazz"
        | "raï"
        | "gnawa"
        | "mbube"
      mobile_money_network: "mtn" | "airtel" | "zamtel"
      mood:
        | "happy"
        | "joyful"
        | "cheerful"
        | "uplifting"
        | "energetic"
        | "exciting"
        | "playful"
        | "fun"
        | "hopeful"
        | "motivational"
        | "confident"
        | "powerful"
        | "triumphant"
        | "peaceful"
        | "calm"
        | "relaxing"
        | "dreamy"
        | "gentle"
        | "romantic"
        | "passionate"
        | "flirty"
        | "sensual"
        | "emotional"
        | "heartfelt"
        | "nostalgic"
        | "sentimental"
        | "reflective"
        | "thoughtful"
        | "melancholic"
        | "sad"
        | "heartbroken"
        | "lonely"
        | "regretful"
        | "dark"
        | "mysterious"
        | "haunting"
        | "suspenseful"
        | "angry"
        | "aggressive"
        | "rebellious"
        | "intense"
        | "anxious"
        | "tense"
        | "spiritual"
        | "inspirational"
        | "carefree"
        | "chill"
        | "groovy"
        | "euphoric"
        | "bittersweet"
        | "cinematic"
        | "epic"
        | "adventurous"
        | "festive"
        | "romantic_sad"
        | "calm_emotional"
        | "dark_energetic"
        | "nostalgic_hopeful"
        | "dreamy_peaceful"
        | "focus"
        | "melancholy"
      subscription_period: "monthly" | "yearly" | "lifetime"
      subscription_status: "pending" | "active" | "rejected"
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
      ai_tool: ["suno", "udio", "stable_audio", "custom_model", "other"],
      app_role: ["listener", "artist", "admin"],
      artwork_shape: ["circle", "rounded", "diamond", "hexagon"],
      genre: [
        "ambient",
        "electronic",
        "hiphop",
        "afrobeats",
        "classical",
        "pop",
        "lofi",
        "experimental",
        "cinematic",
        "world",
        "kalindula",
        "traditional",
        "zed_hiphop",
        "dancehall",
        "amapiano",
        "afrobeat",
        "afropop",
        "rnb",
        "gospel",
        "folk",
        "zamrock",
        "kalindula_modern",
        "zed_gospel",
        "zed_rnb",
        "zed_dancehall",
        "kwaito",
        "gqom",
        "bongo_flava",
        "genge",
        "gengetone",
        "benga",
        "taarab",
        "soukous",
        "rumba",
        "ndombolo",
        "highlife",
        "afroswing",
        "afrohouse",
        "afrofusion",
        "afrosoul",
        "afro_trap",
        "naija_pop",
        "juju",
        "fuji",
        "mbalax",
        "coupe_decale",
        "makossa",
        "bikutsi",
        "chimurenga",
        "sungura",
        "maskandi",
        "mbaqanga",
        "shangaan_electro",
        "ethio_jazz",
        "raï",
        "gnawa",
        "mbube",
      ],
      mobile_money_network: ["mtn", "airtel", "zamtel"],
      mood: [
        "happy",
        "joyful",
        "cheerful",
        "uplifting",
        "energetic",
        "exciting",
        "playful",
        "fun",
        "hopeful",
        "motivational",
        "confident",
        "powerful",
        "triumphant",
        "peaceful",
        "calm",
        "relaxing",
        "dreamy",
        "gentle",
        "romantic",
        "passionate",
        "flirty",
        "sensual",
        "emotional",
        "heartfelt",
        "nostalgic",
        "sentimental",
        "reflective",
        "thoughtful",
        "melancholic",
        "sad",
        "heartbroken",
        "lonely",
        "regretful",
        "dark",
        "mysterious",
        "haunting",
        "suspenseful",
        "angry",
        "aggressive",
        "rebellious",
        "intense",
        "anxious",
        "tense",
        "spiritual",
        "inspirational",
        "carefree",
        "chill",
        "groovy",
        "euphoric",
        "bittersweet",
        "cinematic",
        "epic",
        "adventurous",
        "festive",
        "romantic_sad",
        "calm_emotional",
        "dark_energetic",
        "nostalgic_hopeful",
        "dreamy_peaceful",
        "focus",
        "melancholy",
      ],
      subscription_period: ["monthly", "yearly", "lifetime"],
      subscription_status: ["pending", "active", "rejected"],
    },
  },
} as const
