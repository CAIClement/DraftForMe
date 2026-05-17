# DraftForMe Next.js + Supabase Design

Date: 2026-05-17

## Summary

DraftForMe will be rebuilt as a full Vercel application using Next.js, Supabase, and a TypeScript recommendation engine. The goal is to move from a Flask app with local JSON caches toward a persistent, user-aware coaching product.

The first product direction is a personal coach workspace. It should help a player understand why a champion is recommended, not only show a ranked list. The MVP prioritizes deep recommendations and clear explanations.

## Current Context

The current project is a Flask app with:

- `app.py` exposing API routes and serving `templates/index.html`.
- `static/js/app.js` and `static/css/style.css` implementing the current interface.
- `opgg_scraper.py` fetching Data Dragon, OP.GG champion stats, matchups, builds, and player profiles.
- `recommendation.py` scoring champions with meta, player pool, and counterpick factors.
- `data/*.json` acting as local caches.

This design intentionally replaces the monolithic Flask/runtime JSON model with a Next.js app backed by Supabase.

## Goals

- Build a full Next.js App Router application deployable on Vercel.
- Use Supabase for social auth, Postgres storage, row-level security, and cached LoL data.
- Support Discord and Google sign-in.
- Store user profiles, champion pools, preferences, and recommendation history.
- Prefer Riot/Data Dragon as stable data sources.
- Use OP.GG only as a complementary cached source for meta, builds, and matchup data.
- Port the recommendation engine to TypeScript as a pure, tested module.
- Present recommendations as coaching explanations, not just numeric rankings.

## Non-Goals

- Do not keep Flask as the main app backend.
- Do not run Selenium scraping inside Vercel serverless functions.
- Do not require a logged-in account for every basic interaction.
- Do not attempt to implement every data sync source in the first MVP.

## Architecture

The target app is a single Next.js project deployed on Vercel.

Main units:

- Frontend pages and components in Next.js.
- Server routes for recommendation generation, profile persistence, and data access.
- Supabase Auth for Discord and Google login.
- Supabase Postgres for user data and cached LoL data.
- A pure TypeScript recommendation module with no framework dependency.

The recommendation module receives normalized inputs:

- role
- region and tier
- user champion pool
- enemy picks
- bans
- user preference weights
- normalized champion stats
- optional matchup/build context

It returns ranked recommendations with scores, labels, and human-readable explanation parts.

## Supabase Data Model

Tables should be designed around both user data and shared LoL cache data.

User-owned tables:

- `profiles`: Supabase user id, display name, Riot name/tag if provided, default region, default role.
- `user_preferences`: preferred role, recommendation style, weight preferences, onboarding state.
- `champion_pool_entries`: user id, champion id, mastery metadata, manual confidence, notes, source.
- `recommendation_sessions`: user id, role, region, tier, enemy picks, bans, selected recommendation, created timestamp.
- `recommendation_results`: session id, champion id, score payload, explanation payload, rank.

Shared cache tables:

- `champions`: Riot/Data Dragon id, key, slug, name, tags, image URL, Data Dragon version.
- `champion_stats`: champion id, role, region, tier, win rate, pick rate, ban rate, games, source, fetched timestamp.
- `matchups`: champion id, enemy champion id, role, region, score or win rate, games, source, fetched timestamp.
- `builds`: champion id, role, region, item order, starter items, boots, skill order, source, fetched timestamp.

All exposed tables must have RLS enabled. User-owned rows are readable and writable only by their owner. Shared cache data can be read publicly or through server routes, depending on the final API shape.

The frontend must never receive a Supabase service role key.

## User Experience

The primary UI is an always-available coach workspace.

Core regions:

- Player context: account state, Riot identity, region, tier, role.
- Draft context: enemy picks, bans, current constraints.
- Champion pool: saved champions, confidence, manual edits.
- Recommendations: ranked suggestions with explanations.
- Details panel: why this champion, what changed the score, alternatives, risks, build notes.

The product should feel like a personal coach. Dense statistics are allowed only when they support the explanation. The main output should answer:

- Why this champion?
- Why now?
- What is the tradeoff?
- What are the nearest alternatives?
- What data is missing or uncertain?

A guest mode can offer generic recommendations. Saving champion pools, preferences, and history requires Discord or Google auth.

## Data Flow

On page load, the app reads champion metadata and cached stats from Supabase through server-safe access patterns.

When a user requests recommendations:

1. The frontend submits role, region, tier, pool, enemy picks, bans, and preferences to a Next.js route.
2. The route validates the payload.
3. The route loads normalized stats, matchups, and build context from Supabase.
4. The TypeScript recommendation module scores champions and builds explanation payloads.
5. If the user is authenticated, the route stores the session and results.
6. The route returns the ranked recommendations to the frontend.

If cache data is stale, update should be handled by explicit sync jobs or admin workflows, not by blocking the user on live scraping.

## Data Source Strategy

Riot/Data Dragon is the primary stable source for champion metadata, names, images, tags, and versions.

OP.GG is a complementary source for meta, matchup, and build data. It should be treated as cache input rather than an always-live dependency. Selenium scraping should not run inside Vercel functions.

For MVP, the app may use imported snapshots or existing JSON cache data transformed into Supabase tables. Later iterations can add scheduled sync jobs.

## Recommendation Engine

The TypeScript engine should preserve the useful ideas from the Python engine:

- meta score
- player score
- counter score
- priority weighting
- exclusion of banned and already-picked champions
- graceful handling of missing matchup or player data

It should extend the output with structured explanation parts:

- `summary`: short readable recommendation reason.
- `factors`: weighted components with labels and confidence.
- `warnings`: missing data, weak matchup confidence, low user mastery.
- `alternatives`: nearby champions and why they differ.

The engine must be testable without Supabase, Next.js, or browser context.

## Error Handling

The app should degrade gracefully.

If profile import fails, the user can manually edit their pool.

If matchup data is missing, recommendation results should say matchup confidence is low rather than inventing precision.

If build data is missing, the champion recommendation remains usable and the build section shows that data is unavailable.

If the user is not authenticated, the app still supports a limited guest workflow without persistent history.

## Testing

Recommendation engine tests:

- banned champions are excluded.
- already-picked champions are excluded.
- user pool can increase score.
- meta priority can increase score.
- enemy picks can affect counter score when matchup data exists.
- missing matchup data is handled safely.
- recommendation explanations include the expected factors.

API route tests:

- invalid payloads are rejected.
- authenticated sessions are persisted.
- guest sessions return recommendations without persistence.
- response format stays stable.

Frontend verification:

- Discord or Google auth entry point exists.
- champion pool can be saved for an authenticated user.
- recommendations render with explanations.
- missing data states are visible and non-blocking.
- guest and authenticated behavior differ correctly.

## Migration Plan Outline

Implementation should happen in a later plan, but the intended order is:

1. Scaffold the Next.js app structure.
2. Add Supabase client/server helpers and auth shell.
3. Define migrations for profiles, preferences, champion pools, recommendation history, and LoL cache tables.
4. Port and test the TypeScript recommendation engine.
5. Build the coach workspace UI.
6. Add API routes for recommendation and persistence.
7. Import current JSON cache data as seed or migration support.
8. Deploy preview to Vercel.

## Open Decisions For Implementation Planning

- Exact UI component library: likely Tailwind plus shadcn/ui, unless the codebase chooses a different baseline.
- Whether OP.GG sync is a local/admin script, scheduled external job, or later service.
- Whether Riot account linking is included in MVP or limited to manually entered Riot identity.
- Whether shared cache data is directly readable by anon clients or only exposed through server routes.
