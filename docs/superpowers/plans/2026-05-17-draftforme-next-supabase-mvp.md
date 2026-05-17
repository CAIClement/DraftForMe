# DraftForMe Next Supabase MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Next.js + Supabase version of DraftForMe: authenticated coach workspace, persisted user pool, seeded LoL cache data, and a tested TypeScript recommendation engine with explanations.

**Architecture:** Replace the Flask runtime with a Next.js App Router app deployable to Vercel. Supabase stores user-owned data and shared LoL cache data. The recommendation engine is a pure TypeScript module used by a server route and tested independently.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/Postgres/RLS, Tailwind CSS, Vitest, Testing Library, Zod.

---

## Scope Boundary

This plan implements the first working vertical slice. It does not implement automated OP.GG sync jobs. It imports the existing JSON cache data into Supabase-compatible seed files and leaves automated refresh as a separate plan.

The user explicitly requested to make Git commits manually. Do not run `git commit` in execution. Each task ends with a manual checkpoint command instead.

## Target File Structure

- Create `package.json`: Next.js scripts and dependencies.
- Create `tsconfig.json`: strict TypeScript configuration.
- Create `next.config.ts`: Next.js configuration.
- Create `postcss.config.mjs`: Tailwind PostCSS setup.
- Create `tailwind.config.ts`: Tailwind content and theme tokens.
- Create `src/app/layout.tsx`: root app shell.
- Create `src/app/page.tsx`: coach workspace page.
- Create `src/app/globals.css`: application styling.
- Create `src/components/coach/coach-workspace.tsx`: client workspace state and interactions.
- Create `src/components/coach/recommendation-card.tsx`: recommendation display.
- Create `src/components/coach/champion-picker.tsx`: champion selection control.
- Create `src/lib/recommendation/types.ts`: shared engine types.
- Create `src/lib/recommendation/engine.ts`: pure scoring and explanation logic.
- Create `src/lib/recommendation/engine.test.ts`: engine tests.
- Create `src/lib/supabase/browser.ts`: browser Supabase client.
- Create `src/lib/supabase/server.ts`: server Supabase client.
- Create `src/lib/supabase/types.ts`: minimal database types used by app code.
- Create `src/lib/data/normalize.ts`: mapping between Supabase rows and engine inputs.
- Create `src/app/api/recommend/route.ts`: recommendation API route.
- Create `src/app/api/champion-pool/route.ts`: authenticated champion pool persistence route.
- Create `src/app/auth/callback/route.ts`: Supabase OAuth callback route.
- Create `supabase/migrations/0001_initial_schema.sql`: tables, indexes, and RLS.
- Create `scripts/build-seed-data.mjs`: transform existing JSON cache into SQL seed inserts.
- Create `supabase/seed.sql`: generated seed destination.
- Create `src/test/setup.ts`: test environment setup.
- Create `vitest.config.ts`: Vitest configuration.
- Modify `.gitignore`: ignore `.next`, `node_modules`, `.env.local`, and keep `.superpowers`.

---

### Task 1: Scaffold Next.js Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

Use this exact content:

```json
{
  "name": "draftforme",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed:build": "node scripts/build-seed-data.mjs"
  },
  "dependencies": {
    "@supabase/ssr": "^0.6.1",
    "@supabase/supabase-js": "^2.49.4",
    "lucide-react": "^0.468.0",
    "next": "^15.3.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^22.13.10",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "jsdom": "^26.0.0",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.2",
    "vitest": "^3.0.8"
  }
}
```

- [ ] **Step 2: Create TypeScript and framework config files**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
```

Create `postcss.config.mjs`:

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1115",
        panel: "#171b22",
        line: "#2a303a",
        gold: "#c8aa6e",
        teal: "#0ac8b9",
        danger: "#e84057"
      }
    }
  },
  plugins: []
};

export default config;
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Update `.gitignore`**

Ensure `.gitignore` contains exactly these project-specific entries while preserving any existing entries:

```gitignore
.superpowers/
.next/
node_modules/
.env.local
coverage/
supabase/.branches/
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install without errors.

- [ ] **Step 6: Run initial verification**

Run:

```bash
npm run test
npm run build
```

Expected: `npm run test` reports no test files or passes once test files exist. `npm run build` may fail until `src/app/layout.tsx` exists; if it fails because there is no app directory, continue to Task 2.

- [ ] **Step 7: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: scaffolding files are visible. Do not commit.

---

### Task 2: Add Supabase Schema And RLS

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `src/lib/supabase/types.ts`

- [ ] **Step 1: Create failing schema smoke test file**

Create `src/lib/supabase/types.ts` first so application code has stable names:

```ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      champions: {
        Row: {
          id: string;
          riot_key: string;
          slug: string;
          name: string;
          image_url: string;
          tags: string[];
          ddragon_version: string;
        };
        Insert: {
          id: string;
          riot_key: string;
          slug: string;
          name: string;
          image_url: string;
          tags?: string[];
          ddragon_version: string;
        };
        Update: Partial<Database["public"]["Tables"]["champions"]["Insert"]>;
      };
      champion_stats: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["champion_stats"]["Row"], "id" | "fetched_at"> & {
          id?: string;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["champion_stats"]["Insert"]>;
      };
      champion_pool_entries: {
        Row: {
          id: string;
          user_id: string;
          champion_id: string;
          confidence: number;
          games: number | null;
          win_rate: number | null;
          notes: string | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          champion_id: string;
          confidence?: number;
          games?: number | null;
          win_rate?: number | null;
          notes?: string | null;
          source?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["champion_pool_entries"]["Insert"]>;
      };
      recommendation_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          role: string;
          region: string;
          tier: string;
          enemy_picks: string[];
          bans: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          role: string;
          region: string;
          tier: string;
          enemy_picks?: string[];
          bans?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recommendation_sessions"]["Insert"]>;
      };
    };
  };
};
```

- [ ] **Step 2: Create initial migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
create extension if not exists "pgcrypto";

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  riot_name text,
  riot_tag text,
  default_region text not null default 'euw',
  default_role text not null default 'mid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recommendation_style text not null default 'coach',
  meta_weight int not null default 50 check (meta_weight between 0 and 100),
  pool_weight int not null default 50 check (pool_weight between 0 and 100),
  matchup_weight int not null default 50 check (matchup_weight between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.champions (
  id text primary key,
  riot_key text not null unique,
  slug text not null unique,
  name text not null,
  image_url text not null,
  tags text[] not null default '{}',
  ddragon_version text not null
);

create table public.champion_stats (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  region text not null,
  tier text not null,
  win_rate numeric,
  pick_rate numeric,
  ban_rate numeric,
  games int,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, role, region, tier, source)
);

create table public.matchups (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  enemy_champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  region text not null,
  win_rate numeric,
  games int,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, enemy_champion_id, role, region, source)
);

create table public.builds (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  region text not null,
  core_items jsonb not null default '[]'::jsonb,
  starter_items jsonb not null default '[]'::jsonb,
  boots jsonb,
  skill_order text,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, role, region, source)
);

create table public.champion_pool_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  champion_id text not null references public.champions(id) on delete cascade,
  confidence int not null default 50 check (confidence between 0 and 100),
  games int,
  win_rate numeric,
  notes text,
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  unique (user_id, champion_id)
);

create table public.recommendation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  role text not null,
  region text not null,
  tier text not null,
  enemy_picks text[] not null default '{}',
  bans text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.recommendation_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
  champion_id text not null references public.champions(id) on delete cascade,
  rank int not null,
  total_score numeric not null,
  score_payload jsonb not null,
  explanation_payload jsonb not null
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.champion_pool_entries enable row level security;
alter table public.recommendation_sessions enable row level security;
alter table public.recommendation_results enable row level security;
alter table public.champions enable row level security;
alter table public.champion_stats enable row level security;
alter table public.matchups enable row level security;
alter table public.builds enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "preferences_all_own" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pool_all_own" on public.champion_pool_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions_select_own" on public.recommendation_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own_or_guest" on public.recommendation_sessions for insert with check (user_id is null or auth.uid() = user_id);

create policy "results_select_own" on public.recommendation_results
for select using (
  exists (
    select 1 from public.recommendation_sessions s
    where s.id = recommendation_results.session_id
    and s.user_id = auth.uid()
  )
);

create policy "champions_read_all" on public.champions for select using (true);
create policy "stats_read_all" on public.champion_stats for select using (true);
create policy "matchups_read_all" on public.matchups for select using (true);
create policy "builds_read_all" on public.builds for select using (true);

create index champion_stats_lookup_idx on public.champion_stats (role, region, tier);
create index matchups_lookup_idx on public.matchups (champion_id, role, region);
create index pool_user_idx on public.champion_pool_entries (user_id);
create index recommendation_sessions_user_idx on public.recommendation_sessions (user_id, created_at desc);
```

- [ ] **Step 3: Verify migration parses locally**

Run:

```bash
npx supabase --version
```

Expected: version prints. If Supabase CLI is not installed, install or use the Supabase dashboard SQL editor during execution.

Run:

```bash
npx supabase db reset
```

Expected: migration applies cleanly in local Supabase. If local Supabase is not available, paste the SQL into a Supabase SQL editor for the target project and verify no SQL errors.

- [ ] **Step 4: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: migration and types file are visible. Do not commit.

---

### Task 3: Port Recommendation Engine To TypeScript

**Files:**
- Create: `src/lib/recommendation/types.ts`
- Create: `src/lib/recommendation/engine.ts`
- Create: `src/lib/recommendation/engine.test.ts`

- [ ] **Step 1: Create failing engine tests**

Create `src/lib/recommendation/engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { recommendChampions } from "./engine";
import type { ChampionStats, PlayerPoolEntry } from "./types";

const stats: ChampionStats[] = [
  { championId: "ahri", name: "Ahri", role: "mid", rank: 1, winRate: 52, pickRate: 12, banRate: 4 },
  { championId: "zed", name: "Zed", role: "mid", rank: 2, winRate: 51, pickRate: 10, banRate: 18 },
  { championId: "orianna", name: "Orianna", role: "mid", rank: 8, winRate: 49, pickRate: 7, banRate: 2 }
];

const pool: PlayerPoolEntry[] = [
  { championId: "orianna", name: "Orianna", games: 42, winRate: 61, confidence: 80 }
];

describe("recommendChampions", () => {
  it("excludes banned and already picked champions", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: ["zed"],
      alreadyPickedChampionIds: ["ahri"],
      priority: 50,
      topN: 10
    });

    expect(result.map((r) => r.championId)).toEqual(["orianna"]);
  });

  it("boosts a user's practiced champion when priority is pool-oriented", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 0,
      topN: 1
    });

    expect(result[0].championId).toBe("orianna");
    expect(result[0].explanation.factors.some((factor) => factor.key === "player")).toBe(true);
  });

  it("boosts meta rank when priority is meta-oriented", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 100,
      topN: 1
    });

    expect(result[0].championId).toBe("ahri");
  });

  it("uses matchup data when enemy picks are present", () => {
    const result = recommendChampions({
      stats,
      playerPool: [],
      enemyPicks: ["zed"],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 1,
      matchups: [
        { championId: "ahri", enemyChampionId: "zed", winRate: 54 },
        { championId: "orianna", enemyChampionId: "zed", winRate: 47 }
      ]
    });

    expect(result[0].championId).toBe("ahri");
    expect(result[0].explanation.summary).toContain("matchup");
  });

  it("reports low confidence when matchup data is missing", () => {
    const result = recommendChampions({
      stats,
      playerPool: [],
      enemyPicks: ["zed"],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 1,
      matchups: []
    });

    expect(result[0].explanation.warnings).toContain("Matchup data is incomplete for the current enemy picks.");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/lib/recommendation/engine.test.ts
```

Expected: FAIL because `src/lib/recommendation/engine.ts` and `types.ts` do not exist.

- [ ] **Step 3: Create engine types**

Create `src/lib/recommendation/types.ts`:

```ts
export type ChampionStats = {
  championId: string;
  name: string;
  role: string;
  rank: number;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
};

export type PlayerPoolEntry = {
  championId: string;
  name: string;
  games: number | null;
  winRate: number | null;
  confidence: number;
};

export type Matchup = {
  championId: string;
  enemyChampionId: string;
  winRate: number | null;
};

export type RecommendationFactor = {
  key: "meta" | "player" | "counter";
  label: string;
  score: number;
  weight: number;
  detail: string;
};

export type RecommendationExplanation = {
  summary: string;
  factors: RecommendationFactor[];
  warnings: string[];
  alternatives: string[];
};

export type Recommendation = {
  championId: string;
  championName: string;
  totalScore: number;
  metaScore: number;
  playerScore: number;
  counterScore: number;
  explanation: RecommendationExplanation;
};

export type RecommendInput = {
  stats: ChampionStats[];
  playerPool: PlayerPoolEntry[];
  enemyPicks: string[];
  bannedChampionIds: string[];
  alreadyPickedChampionIds: string[];
  priority: number;
  topN: number;
  matchups?: Matchup[];
};
```

- [ ] **Step 4: Implement engine**

Create `src/lib/recommendation/engine.ts`:

```ts
import type {
  ChampionStats,
  Matchup,
  PlayerPoolEntry,
  RecommendInput,
  Recommendation
} from "./types";

const MIN_GAMES_FOR_POOL = 10;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function metaScore(champion: ChampionStats, totalChampions: number): number {
  const total = Math.max(totalChampions, 1);
  return clamp(100 - ((champion.rank - 1) / total) * 90);
}

function playerScore(championId: string, playerPool: PlayerPoolEntry[]): number {
  const entry = playerPool.find((poolEntry) => poolEntry.championId === championId);
  if (!entry) return 5;

  const games = entry.games ?? 0;
  if (games < MIN_GAMES_FOR_POOL) return 5;

  const winRate = entry.winRate ?? 50;
  const confidence = clamp(entry.confidence);
  const winRateBonus = (winRate - 50) * 2;
  const gamesBonus = Math.min(games * 0.6, 35);

  return clamp(20 + winRateBonus + gamesBonus + confidence * 0.25);
}

function counterScore(championId: string, enemyPicks: string[], matchups: Matchup[]): number {
  if (enemyPicks.length === 0) return 50;

  const scores = enemyPicks.map((enemyChampionId) => {
    const matchup = matchups.find(
      (item) => item.championId === championId && item.enemyChampionId === enemyChampionId
    );
    if (!matchup || matchup.winRate === null) return 0;
    return (matchup.winRate - 50) * 4;
  });

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return clamp(50 + average);
}

function computeWeights(priority: number, hasEnemy: boolean, hasPool: boolean) {
  const p = clamp(priority) / 100;
  let meta = 0.05 + p * 0.9;
  let player = 0.95 - p * 0.9;

  if (!hasPool) {
    meta = 0.95;
    player = 0.05;
  }

  const counter = hasEnemy ? 0.4 : 0;
  meta *= 1 - counter;
  player *= 1 - counter;

  const total = meta + player + counter;
  return {
    meta: meta / total,
    player: player / total,
    counter: counter / total
  };
}

function buildSummary(meta: number, player: number, counter: number, hasEnemy: boolean): string {
  const strongest = [
    { key: "meta", score: meta, text: "strong current meta profile" },
    { key: "player", score: player, text: "good fit with your champion pool" },
    { key: "counter", score: counter, text: "useful matchup angle" }
  ].sort((a, b) => b.score - a.score)[0];

  if (hasEnemy && strongest.key === "counter") {
    return "Recommended mainly because the matchup context is favorable.";
  }

  return `Recommended because it has a ${strongest.text}.`;
}

function hasCompleteMatchupData(championId: string, enemyPicks: string[], matchups: Matchup[]): boolean {
  return enemyPicks.every((enemyChampionId) =>
    matchups.some((item) => item.championId === championId && item.enemyChampionId === enemyChampionId)
  );
}

export function recommendChampions(input: RecommendInput): Recommendation[] {
  const banned = new Set(input.bannedChampionIds);
  const picked = new Set(input.alreadyPickedChampionIds);
  const matchups = input.matchups ?? [];
  const hasEnemy = input.enemyPicks.length > 0;
  const hasPool = input.playerPool.some((entry) => (entry.games ?? 0) >= MIN_GAMES_FOR_POOL);
  const weights = computeWeights(input.priority, hasEnemy, hasPool);

  const recommendations = input.stats
    .filter((champion) => !banned.has(champion.championId) && !picked.has(champion.championId))
    .map((champion) => {
      const meta = metaScore(champion, input.stats.length);
      const player = playerScore(champion.championId, input.playerPool);
      const counter = counterScore(champion.championId, input.enemyPicks, matchups);
      const total = meta * weights.meta + player * weights.player + counter * weights.counter;
      const warnings: string[] = [];

      if (hasEnemy && !hasCompleteMatchupData(champion.championId, input.enemyPicks, matchups)) {
        warnings.push("Matchup data is incomplete for the current enemy picks.");
      }

      return {
        championId: champion.championId,
        championName: champion.name,
        totalScore: round(total),
        metaScore: round(meta),
        playerScore: round(player),
        counterScore: round(counter),
        explanation: {
          summary: buildSummary(meta, player, counter, hasEnemy),
          factors: [
            {
              key: "meta" as const,
              label: "Meta strength",
              score: round(meta),
              weight: round(weights.meta * 100),
              detail: `Rank #${champion.rank} for ${champion.role}.`
            },
            {
              key: "player" as const,
              label: "Personal fit",
              score: round(player),
              weight: round(weights.player * 100),
              detail: player > 5 ? "This champion is represented in your pool." : "This champion is not established in your pool."
            },
            {
              key: "counter" as const,
              label: "Matchup context",
              score: round(counter),
              weight: round(weights.counter * 100),
              detail: hasEnemy ? "Enemy picks are part of this score." : "No enemy picks selected yet."
            }
          ],
          warnings,
          alternatives: []
        }
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, input.topN);

  return recommendations.map((recommendation, index) => ({
    ...recommendation,
    explanation: {
      ...recommendation.explanation,
      alternatives: recommendations
        .filter((_, alternativeIndex) => alternativeIndex !== index)
        .slice(0, 2)
        .map((alternative) => alternative.championName)
    }
  }));
}
```

- [ ] **Step 5: Run engine tests**

Run:

```bash
npm run test -- src/lib/recommendation/engine.test.ts
```

Expected: PASS for all five tests.

- [ ] **Step 6: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: engine files and tests are visible. Do not commit.

---

### Task 4: Add Supabase Clients And Data Normalization

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/data/normalize.ts`
- Create: `src/lib/data/normalize.test.ts`

- [ ] **Step 1: Create failing normalization tests**

Create `src/lib/data/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapStatsRowsToChampionStats } from "./normalize";

describe("mapStatsRowsToChampionStats", () => {
  it("joins champion rows and stats rows into engine input", () => {
    const result = mapStatsRowsToChampionStats([
      {
        champion_id: "ahri",
        role: "mid",
        win_rate: 52,
        pick_rate: 12,
        ban_rate: 3,
        champions: { id: "ahri", name: "Ahri" }
      }
    ]);

    expect(result).toEqual([
      {
        championId: "ahri",
        name: "Ahri",
        role: "mid",
        rank: 1,
        winRate: 52,
        pickRate: 12,
        banRate: 3
      }
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/lib/data/normalize.test.ts
```

Expected: FAIL because `normalize.ts` does not exist.

- [ ] **Step 3: Create Supabase browser client**

Create `src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createBrowserClient<Database>(url, key);
}
```

- [ ] **Step 4: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}
```

- [ ] **Step 5: Create normalization helpers**

Create `src/lib/data/normalize.ts`:

```ts
import type { ChampionStats, PlayerPoolEntry } from "@/lib/recommendation/types";

type StatsRow = {
  champion_id: string;
  role: string;
  win_rate: number | null;
  pick_rate: number | null;
  ban_rate: number | null;
  champions: {
    id: string;
    name: string;
  } | null;
};

type PoolRow = {
  champion_id: string;
  confidence: number;
  games: number | null;
  win_rate: number | null;
  champions: {
    id: string;
    name: string;
  } | null;
};

export function mapStatsRowsToChampionStats(rows: StatsRow[]): ChampionStats[] {
  return rows
    .filter((row) => row.champions !== null)
    .map((row, index) => ({
      championId: row.champion_id,
      name: row.champions?.name ?? row.champion_id,
      role: row.role,
      rank: index + 1,
      winRate: row.win_rate,
      pickRate: row.pick_rate,
      banRate: row.ban_rate
    }));
}

export function mapPoolRowsToPlayerPool(rows: PoolRow[]): PlayerPoolEntry[] {
  return rows
    .filter((row) => row.champions !== null)
    .map((row) => ({
      championId: row.champion_id,
      name: row.champions?.name ?? row.champion_id,
      games: row.games,
      winRate: row.win_rate,
      confidence: row.confidence
    }));
}
```

- [ ] **Step 6: Run normalization tests**

Run:

```bash
npm run test -- src/lib/data/normalize.test.ts
```

Expected: PASS.

- [ ] **Step 7: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: Supabase client and normalization files are visible. Do not commit.

---

### Task 5: Add Recommendation API Route

**Files:**
- Create: `src/app/api/recommend/route.ts`
- Create: `src/app/api/recommend/route.test.ts`

- [ ] **Step 1: Create route unit test**

Create `src/app/api/recommend/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { recommendationRequestSchema } from "./route";

describe("recommendationRequestSchema", () => {
  it("accepts a valid guest recommendation request", () => {
    const parsed = recommendationRequestSchema.parse({
      role: "mid",
      region: "euw",
      tier: "emerald_plus",
      enemyPicks: ["zed"],
      bans: [],
      priority: 50
    });

    expect(parsed.role).toBe("mid");
  });

  it("rejects an invalid priority", () => {
    expect(() =>
      recommendationRequestSchema.parse({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [],
        bans: [],
        priority: 101
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/app/api/recommend/route.test.ts
```

Expected: FAIL because route module does not exist.

- [ ] **Step 3: Implement recommendation route**

Create `src/app/api/recommend/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { mapPoolRowsToPlayerPool, mapStatsRowsToChampionStats } from "@/lib/data/normalize";
import { recommendChampions } from "@/lib/recommendation/engine";
import { createClient } from "@/lib/supabase/server";

export const recommendationRequestSchema = z.object({
  role: z.string().min(1),
  region: z.string().min(1),
  tier: z.string().min(1),
  enemyPicks: z.array(z.string()).default([]),
  bans: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  topN: z.number().int().min(1).max(20).default(10)
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = recommendationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recommendation request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: statsRows, error: statsError } = await supabase
    .from("champion_stats")
    .select("champion_id, role, win_rate, pick_rate, ban_rate, champions(id, name)")
    .eq("role", parsed.data.role)
    .eq("region", parsed.data.region)
    .eq("tier", parsed.data.tier)
    .order("win_rate", { ascending: false });

  if (statsError) {
    return NextResponse.json({ error: "Unable to load champion stats." }, { status: 500 });
  }

  const { data: poolRows } = user
    ? await supabase
        .from("champion_pool_entries")
        .select("champion_id, confidence, games, win_rate, champions(id, name)")
        .eq("user_id", user.id)
    : { data: [] };

  const stats = mapStatsRowsToChampionStats(statsRows ?? []);
  const playerPool = mapPoolRowsToPlayerPool(poolRows ?? []);

  const recommendations = recommendChampions({
    stats,
    playerPool,
    enemyPicks: parsed.data.enemyPicks,
    bannedChampionIds: parsed.data.bans,
    alreadyPickedChampionIds: parsed.data.enemyPicks,
    priority: parsed.data.priority,
    topN: parsed.data.topN
  });

  if (user) {
    await supabase.from("recommendation_sessions").insert({
      user_id: user.id,
      role: parsed.data.role,
      region: parsed.data.region,
      tier: parsed.data.tier,
      enemy_picks: parsed.data.enemyPicks,
      bans: parsed.data.bans
    });
  }

  return NextResponse.json({ recommendations });
}
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm run test -- src/app/api/recommend/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: API route and test files are visible. Do not commit.

---

### Task 6: Build Coach Workspace UI

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/components/coach/coach-workspace.tsx`
- Create: `src/components/coach/recommendation-card.tsx`
- Create: `src/components/coach/champion-picker.tsx`

- [ ] **Step 1: Create root layout**

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DraftForMe",
  description: "Personal League of Legends draft coach"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create global CSS**

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  min-height: 100vh;
  margin: 0;
  background: #0f1115;
  color: #eef2f6;
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
select {
  font: inherit;
}
```

- [ ] **Step 3: Create recommendation card**

Create `src/components/coach/recommendation-card.tsx`:

```tsx
import type { Recommendation } from "@/lib/recommendation/types";

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <article className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{recommendation.championName}</h3>
          <p className="mt-1 text-sm text-slate-300">{recommendation.explanation.summary}</p>
        </div>
        <div className="text-2xl font-bold text-teal">{recommendation.totalScore}</div>
      </div>

      <div className="mt-4 grid gap-2">
        {recommendation.explanation.factors.map((factor) => (
          <div key={factor.key} className="rounded-md bg-ink p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">{factor.label}</span>
              <span className="text-slate-300">
                {factor.score} · poids {factor.weight}%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{factor.detail}</p>
          </div>
        ))}
      </div>

      {recommendation.explanation.warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-danger/50 bg-danger/10 p-3 text-sm text-red-100">
          {recommendation.explanation.warnings.join(" ")}
        </div>
      ) : null}

      {recommendation.explanation.alternatives.length > 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Alternatives proches : {recommendation.explanation.alternatives.join(", ")}
        </p>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Create champion picker**

Create `src/components/coach/champion-picker.tsx`:

```tsx
"use client";

type Champion = {
  id: string;
  name: string;
};

export function ChampionPicker({
  champions,
  selectedIds,
  onToggle
}: {
  champions: Champion[];
  selectedIds: string[];
  onToggle: (championId: string) => void;
}) {
  return (
    <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3">
      {champions.map((champion) => {
        const selected = selectedIds.includes(champion.id);
        return (
          <button
            key={champion.id}
            type="button"
            onClick={() => onToggle(champion.id)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
              selected
                ? "border-teal bg-teal/15 text-white"
                : "border-line bg-panel text-slate-300 hover:border-slate-500"
            }`}
          >
            {champion.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Create coach workspace**

Create `src/components/coach/coach-workspace.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ChampionPicker } from "./champion-picker";
import { RecommendationCard } from "./recommendation-card";
import type { Recommendation } from "@/lib/recommendation/types";

type Champion = {
  id: string;
  name: string;
};

const fallbackChampions: Champion[] = [
  { id: "ahri", name: "Ahri" },
  { id: "orianna", name: "Orianna" },
  { id: "zed", name: "Zed" },
  { id: "jinx", name: "Jinx" },
  { id: "kaisa", name: "Kai'Sa" }
];

export function CoachWorkspace({ champions = fallbackChampions }: { champions?: Champion[] }) {
  const [role, setRole] = useState("mid");
  const [enemyPicks, setEnemyPicks] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [priority, setPriority] = useState(50);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => [...enemyPicks, ...bans], [enemyPicks, bans]);

  function toggleEnemy(championId: string) {
    setEnemyPicks((current) =>
      current.includes(championId) ? current.filter((id) => id !== championId) : [...current, championId]
    );
  }

  function toggleBan(championId: string) {
    setBans((current) =>
      current.includes(championId) ? current.filter((id) => id !== championId) : [...current, championId]
    );
  }

  async function requestRecommendations() {
    setIsLoading(true);
    setError(null);
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        region: "euw",
        tier: "emerald_plus",
        enemyPicks,
        bans,
        priority
      })
    });

    if (!response.ok) {
      setError("Impossible de générer une recommandation avec les données actuelles.");
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as { recommendations: Recommendation[] };
    setRecommendations(payload.recommendations);
    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-ink">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-panel p-4">
            <h1 className="text-2xl font-semibold text-white">DraftForMe</h1>
            <p className="mt-2 text-sm text-slate-300">Ton coach personnel pour comprendre le meilleur pick.</p>
          </section>

          <section className="rounded-md border border-line bg-panel p-4">
            <label className="text-sm font-medium text-white" htmlFor="role">
              Rôle
            </label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2 text-white"
            >
              <option value="top">Top</option>
              <option value="jungle">Jungle</option>
              <option value="mid">Mid</option>
              <option value="adc">ADC</option>
              <option value="support">Support</option>
            </select>
          </section>

          <section className="rounded-md border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-white">Priorité meta</h2>
              <span className="text-sm text-slate-300">{priority}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              className="mt-3 w-full"
            />
          </section>
        </aside>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <section className="rounded-md border border-line bg-panel p-4">
              <h2 className="font-medium text-white">Picks ennemis</h2>
              <div className="mt-3">
                <ChampionPicker champions={champions} selectedIds={enemyPicks} onToggle={toggleEnemy} />
              </div>
            </section>

            <section className="rounded-md border border-line bg-panel p-4">
              <h2 className="font-medium text-white">Bans</h2>
              <div className="mt-3">
                <ChampionPicker champions={champions} selectedIds={bans} onToggle={toggleBan} />
              </div>
            </section>

            <button
              type="button"
              onClick={requestRecommendations}
              disabled={isLoading || selectedIds.length === 0}
              className="w-full rounded-md bg-gold px-4 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Analyse en cours..." : "Générer les recommandations"}
            </button>
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Meilleurs choix</h2>
            {recommendations.length === 0 ? (
              <div className="rounded-md border border-line bg-panel p-6 text-sm text-slate-300">
                Ajoute des picks ennemis ou des bans, puis lance l'analyse.
              </div>
            ) : (
              recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.championId} recommendation={recommendation} />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create page**

Create `src/app/page.tsx`:

```tsx
import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  let champions = undefined;

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("champions").select("id, name").order("name");
    champions = data ?? undefined;
  } catch {
    champions = undefined;
  }

  return <CoachWorkspace champions={champions} />;
}
```

- [ ] **Step 7: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds when Supabase environment variables exist. If env vars are missing, create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-local-or-project-anon-key
```

Then rerun `npm run build`.

- [ ] **Step 8: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: app and component files are visible. Do not commit.

---

### Task 7: Add Champion Pool API

**Files:**
- Create: `src/app/api/champion-pool/route.ts`
- Create: `src/app/api/champion-pool/route.test.ts`

- [ ] **Step 1: Create schema tests**

Create `src/app/api/champion-pool/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { championPoolEntrySchema } from "./route";

describe("championPoolEntrySchema", () => {
  it("accepts a valid champion pool entry", () => {
    const parsed = championPoolEntrySchema.parse({
      championId: "ahri",
      confidence: 75,
      games: 20,
      winRate: 55
    });

    expect(parsed.championId).toBe("ahri");
  });

  it("rejects invalid confidence", () => {
    expect(() =>
      championPoolEntrySchema.parse({
        championId: "ahri",
        confidence: 120
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test -- src/app/api/champion-pool/route.test.ts
```

Expected: FAIL because route module does not exist.

- [ ] **Step 3: Implement champion pool route**

Create `src/app/api/champion-pool/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const championPoolEntrySchema = z.object({
  championId: z.string().min(1),
  confidence: z.number().int().min(0).max(100).default(50),
  games: z.number().int().min(0).nullable().optional(),
  winRate: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

const championPoolRequestSchema = z.object({
  entries: z.array(championPoolEntrySchema).max(30)
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("champion_pool_entries")
    .select("champion_id, confidence, games, win_rate, notes, champions(id, name)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load champion pool." }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = championPoolRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid champion pool payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = parsed.data.entries.map((entry) => ({
    user_id: user.id,
    champion_id: entry.championId,
    confidence: entry.confidence,
    games: entry.games ?? null,
    win_rate: entry.winRate ?? null,
    notes: entry.notes ?? null,
    source: "manual"
  }));

  const { error } = await supabase
    .from("champion_pool_entries")
    .upsert(rows, { onConflict: "user_id,champion_id" });

  if (error) {
    return NextResponse.json({ error: "Unable to save champion pool." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", saved: rows.length });
}
```

- [ ] **Step 4: Run API schema tests**

Run:

```bash
npm run test -- src/app/api/champion-pool/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: champion pool route and tests are visible. Do not commit.

---

### Task 8: Add Auth Callback And Login Actions

**Files:**
- Create: `src/app/auth/callback/route.ts`
- Modify: `src/components/coach/coach-workspace.tsx`

- [ ] **Step 1: Create OAuth callback route**

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL("/", request.url));
}
```

- [ ] **Step 2: Add login buttons to workspace**

Modify the first card in `src/components/coach/coach-workspace.tsx` so it includes login links:

```tsx
<section className="rounded-md border border-line bg-panel p-4">
  <h1 className="text-2xl font-semibold text-white">DraftForMe</h1>
  <p className="mt-2 text-sm text-slate-300">Ton coach personnel pour comprendre le meilleur pick.</p>
  <div className="mt-4 flex gap-2">
    <a className="rounded-md border border-line px-3 py-2 text-sm text-white" href="/auth/login?provider=discord">
      Discord
    </a>
    <a className="rounded-md border border-line px-3 py-2 text-sm text-white" href="/auth/login?provider=google">
      Google
    </a>
  </div>
</section>
```

- [ ] **Step 3: Add login route**

Create `src/app/auth/login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get("provider");

  if (provider !== "discord" && provider !== "google") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback`
    }
  });

  if (!data.url) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(data.url);
}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: auth routes and workspace modification are visible. Do not commit.

---

### Task 9: Seed Current JSON Cache Into Supabase Format

**Files:**
- Create: `scripts/build-seed-data.mjs`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create seed builder script**

Create `scripts/build-seed-data.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const outFile = path.join(root, "supabase", "seed.sql");

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "null";
}

const ddragonPath = path.join(dataDir, "ddragon_champions.json");
const champions = JSON.parse(fs.readFileSync(ddragonPath, "utf8"));

const lines = [
  "-- Generated by scripts/build-seed-data.mjs",
  "begin;"
];

for (const [name, champion] of Object.entries(champions)) {
  const id = String(champion.id).toLowerCase();
  const tags = `{${(champion.tags ?? []).map((tag) => `"${String(tag).replaceAll('"', '\\"')}"`).join(",")}}`;
  const versionMatch = String(champion.image).match(/cdn\\/([^/]+)\\/img/);
  const version = versionMatch?.[1] ?? "unknown";
  lines.push(
    `insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) values (` +
      `${sql(id)}, ${sql(String(champion.key))}, ${sql(id)}, ${sql(name)}, ${sql(champion.image)}, ${sql(tags)}, ${sql(version)}` +
      `) on conflict (id) do update set name = excluded.name, image_url = excluded.image_url, tags = excluded.tags, ddragon_version = excluded.ddragon_version;`
  );
}

for (const fileName of fs.readdirSync(dataDir)) {
  const match = fileName.match(/^tierlist_([^_]+)_([^_]+(?:_[^_]+)*)_(top|jungle|mid|adc|support)\\.json$/);
  if (!match) continue;

  const [, region, tier, role] = match;
  const rows = JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8"));

  for (const row of rows) {
    const championId = String(row.slug || row.name).toLowerCase().replaceAll("'", "").replaceAll(".", "").replaceAll(" ", "");
    lines.push(
      `insert into public.champion_stats (champion_id, role, region, tier, win_rate, pick_rate, ban_rate, games, source) values (` +
        `${sql(championId)}, ${sql(role)}, ${sql(region)}, ${sql(tier)}, ${numberOrNull(row.win_rate)}, ${numberOrNull(row.pick_rate)}, ${numberOrNull(row.ban_rate)}, null, 'opgg_cache'` +
        `) on conflict (champion_id, role, region, tier, source) do update set win_rate = excluded.win_rate, pick_rate = excluded.pick_rate, ban_rate = excluded.ban_rate, fetched_at = now();`
    );
  }
}

lines.push("commit;");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${lines.join("\n")}\n`);
console.log(`Wrote ${outFile}`);
```

- [ ] **Step 2: Generate seed SQL**

Run:

```bash
npm run seed:build
```

Expected: `supabase/seed.sql` is written.

- [ ] **Step 3: Apply seed locally**

Run:

```bash
npx supabase db reset
```

Expected: local DB resets and seed applies. If local Supabase is unavailable, run `supabase/seed.sql` in the Supabase SQL editor after applying the migration.

- [ ] **Step 4: Manual checkpoint**

Run:

```bash
git status --short
```

Expected: seed script and seed SQL are visible. Do not commit.

---

### Task 10: End-To-End Verification

**Files:**
- No new files expected.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Expected: Next.js starts on `http://localhost:3000` or another available port.

- [ ] **Step 4: Browser smoke test**

Open the dev URL in the in-app browser and verify:

- The coach workspace renders.
- Role select changes value.
- Enemy picks can be selected.
- Bans can be selected.
- Generate button calls `/api/recommend`.
- Recommendations render with score and explanation factors when Supabase has seeded stats.
- Missing Supabase data shows a non-blocking error instead of a blank page.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected: implementation files are visible. Data JSON files modified before this plan may still appear; do not revert them.

---

## Self-Review

Spec coverage:

- Next.js App Router and Vercel-compatible structure: Tasks 1, 6, 10.
- Supabase auth and storage: Tasks 2, 4, 7, 8.
- User champion pool persistence: Tasks 2 and 7.
- Shared LoL cache data: Tasks 2 and 9.
- TypeScript recommendation engine: Task 3.
- Coach workspace UI: Task 6.
- Guest recommendation flow: Tasks 5 and 6.
- No Selenium in Vercel functions: Scope Boundary and Task 9.
- Tests and verification: Tasks 3, 4, 5, 7, 10.

Placeholder scan:

- No `TBD`, `TODO`, or undefined implementation steps.
- Automated OP.GG sync is intentionally excluded from this first vertical slice and named in the scope boundary.

Type consistency:

- Engine uses `championId`, `enemyChampionId`, `winRate`, `pickRate`, and `banRate`.
- API maps Supabase snake_case rows into engine camelCase inputs through `src/lib/data/normalize.ts`.
- UI consumes `Recommendation` from `src/lib/recommendation/types.ts`.
