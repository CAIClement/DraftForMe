export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      champions: TableDefinition<
        {
          id: string;
          riot_key: string;
          slug: string;
          name: string;
          image_url: string;
          tags: string[];
          ddragon_version: string;
        },
        {
          id: string;
          riot_key: string;
          slug: string;
          name: string;
          image_url: string;
          tags?: string[];
          ddragon_version: string;
        },
        Partial<{
          id: string;
          riot_key: string;
          slug: string;
          name: string;
          image_url: string;
          tags?: string[];
          ddragon_version: string;
        }>
      >;
      champion_stats: TableDefinition<
        {
          id: string;
          champion_id: string;
          role: string;
          region: string;
          tier: string;
          win_rate: number | null;
          pick_rate: number | null;
          ban_rate: number | null;
          games: number | null;
          source: string;
          fetched_at: string;
        },
        {
          champion_id: string;
          role: string;
          region: string;
          tier: string;
          win_rate?: number | null;
          pick_rate?: number | null;
          ban_rate?: number | null;
          games?: number | null;
          source: string;
          id?: string;
          fetched_at?: string;
        },
        Partial<{
          id: string;
          champion_id: string;
          role: string;
          region: string;
          tier: string;
          win_rate: number | null;
          pick_rate: number | null;
          ban_rate: number | null;
          games: number | null;
          source: string;
          fetched_at: string;
        }>
      >;
      champion_pool_entries: TableDefinition<
        {
          id: string;
          user_id: string;
          champion_id: string;
          confidence: number;
          games: number | null;
          win_rate: number | null;
          notes: string | null;
          source: string;
          updated_at: string;
        },
        {
          id?: string;
          user_id: string;
          champion_id: string;
          confidence?: number;
          games?: number | null;
          win_rate?: number | null;
          notes?: string | null;
          source?: string;
          updated_at?: string;
        },
        Partial<{
          id: string;
          user_id: string;
          champion_id: string;
          confidence: number;
          games: number | null;
          win_rate: number | null;
          notes: string | null;
          source: string;
          updated_at: string;
        }>
      >;
      counter_relations: TableDefinition<
        {
          id: string;
          champion_id: string;
          countered_by_champion_id: string;
          role: string;
          source: string;
          fetched_at: string;
        },
        {
          champion_id: string;
          countered_by_champion_id: string;
          role: string;
          source: string;
          id?: string;
          fetched_at?: string;
        },
        Partial<{
          id: string;
          champion_id: string;
          countered_by_champion_id: string;
          role: string;
          source: string;
          fetched_at: string;
        }>
      >;
      recommendation_sessions: TableDefinition<
        {
          id: string;
          user_id: string | null;
          role: string;
          region: string;
          tier: string;
          enemy_picks: string[];
          bans: string[];
          created_at: string;
        },
        {
          id?: string;
          user_id?: string | null;
          role: string;
          region: string;
          tier: string;
          enemy_picks?: string[];
          bans?: string[];
          created_at?: string;
        },
        Partial<{
          id: string;
          user_id: string | null;
          role: string;
          region: string;
          tier: string;
          enemy_picks: string[];
          bans: string[];
          created_at: string;
        }>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
