# DraftForMe Site Statistics Refresh Design

Date: 2026-09-18

## Summary

Replace the champion statistics the site shows and scores with, currently OP.GG figures from patch 16.3 scraped in February, by statistics computed from the ranked matches collected through the Riot API (`ml/collect/`), for the current patch and the Emerald+ population the site already targets.

## Why

- **The site's numbers are months old.** `champion_stats` was seeded from `data/tierlist_*.json`, produced in February by a Selenium OP.GG scraper that the May cleanup removed. Nothing in the repository can refresh them any more.
- **Public statistics are what predicts wins.** The win model project (`2026-09-17-draftforme-win-model-design.md`) found that public champion statistics, even from 16.3, predicted the winner of a draft as well as anything learned from drafts. Making those statistics current is the most direct improvement available to the recommendations.
- **The Riot API is the legitimate source** the project already uses, and the collection database holds the current patch.

## Decisions

| Question | Decision |
|---|---|
| Source | The collection database built by `ml/collect/`, read-only |
| Population | Emerald+ (Emerald, Diamond, Master, Grandmaster, Challenger), by each match's `seed_tier`, as the site already labels its data "EUW · Emerald+" |
| Small samples | The ranking uses a win rate smoothed towards 50 % with a prior of 50 games; a champion with fewer than 30 games in a role is not written for that role, so it is not recommended there |
| Display | Unchanged: the raw win rate and the number of games |
| Champions | Refreshed from Data Dragon for the database's patch, which also makes the site's patch label read the current patch |
| Pipeline | A Python command writes JSON files in `data/`; the existing `scripts/build-seed-data.mjs` turns them into `supabase/seed.sql` |
| Counters | Out of scope: `counter_relations` stays on the February OP.GG data until the matchups project replaces it |

## Scope

- **In:** a command computing the statistics; refreshing `data/ddragon_champions.json`; the seed script reading the new file; a migration adding the ranking column; the site ordering by it.
- **Out:** counters and matchups (next project), other regions or tier groups, an elo selector, applying the seed and the migration to the production database (the owner's action, as today), and any change to how the engine scores.

## The Statistics

`python -m ml.stats.export --db <path to matches.sqlite>` reads the collection database read-only and keeps the matches whose `seed_tier` is Emerald or above.

For every champion and role, where the role is the one Riot recorded (`teamPosition`, already stored as the draft columns):

- `games`: the matches in which the champion played that role;
- `wins`: those won by the champion's team;
- `win_rate`: `wins / games`, in percent;
- `ranking_win_rate`: `(wins + 0.5 * 50) / (games + 50)`, in percent — the raw rate pulled towards 50 % by a prior of 50 games, so a champion needs many games before the ranking believes an extreme rate;
- `pick_rate`: `games` divided by the number of matches, in percent (a champion appears at most once per match);
- `ban_rate`: the share of matches in which the champion was banned by either team, in percent. It is a property of the champion, so every role row of a champion carries the same value.

A champion with fewer than 30 games in a role gets no row for that role. The site therefore does not propose it there, and ranks it nowhere.

**Expected volume.** On the 8,060 Emerald+ matches collected so far, a role keeps roughly the champions played at least 30 times in it. That is fewer candidates per role than OP.GG's 36 to 55, and the number grows as collection continues. The command prints the count per role so the owner sees it before seeding.

## Champions and Patch

The command reads the database's single patch (for example `16.18`), finds the newest Data Dragon version of that patch (`https://ddragon.leagueoflegends.com/api/versions.json`, first entry starting with `16.18.`), downloads that version's `champion.json`, and rewrites `data/ddragon_champions.json` in its existing format (`id`, `key`, `image`, `tags` per champion name). Champions released since 16.3 are included; image URLs point at the new version. Because the site derives its patch label from `champions.ddragon_version`, it will then read the current patch.

A champion id in the matches that Data Dragon does not know stops the command with a message, rather than writing statistics the seed could not attach to a champion.

## Files Written

- `data/ddragon_champions.json`, refreshed as above.
- `data/riot_stats_euw_emerald_plus.json`:

```
{
  "source": "riot_matches",
  "region": "euw",
  "tier": "emerald_plus",
  "patch": "16.18",
  "generated_at": "<ISO date>",
  "matches": 8060,
  "prior_games": 50,
  "min_games": 30,
  "rows": [
    {"champion_id": "ahri", "role": "mid", "games": 612, "wins": 318,
     "win_rate": 51.96, "ranking_win_rate": 51.82, "pick_rate": 7.59, "ban_rate": 3.1}
  ]
}
```

`champion_id` is the lowercase Data Dragon id, the same form `scripts/build-seed-data.mjs` already uses for `champions.id`.

## Seed and Database

- **Migration `0004`** adds `ranking_win_rate numeric` to `champion_stats` and backfills it with `win_rate` for existing rows, so nothing breaks between applying the migration and reseeding.
- **`scripts/build-seed-data.mjs`**: when `data/riot_stats_*.json` exists, it writes `champion_stats` from it with source `riot_matches`, fills `ranking_win_rate`, and emits `delete from public.champion_stats where source = 'opgg_cache';` first, so a reseeded database holds one source only. `counter_relations` keeps coming from the tier-list files. Without a stats file, the script behaves exactly as today.
- **Types:** `src/lib/supabase/types.ts` gains the column.

## Site

- `src/app/page.tsx` and `src/app/api/recommend/route.ts` order `champion_stats` by `ranking_win_rate` descending instead of `win_rate`. The engine's rank is the position in that order, as today.
- The dossier's `Classement winrate` fact becomes `Classement (winrate lissé)`, since the order is no longer the raw win rate shown beside it.
- Everything else is unchanged: displayed win rate, pick rate, ban rate and games are the raw values.

## Error Handling

The command's output is French and cp1252-safe; each expected failure ends with a message and an exit code, never a traceback:

| Code | Situation |
|---|---|
| 0 | Files written |
| 2 | Invalid arguments, or the database does not exist |
| 3 | The database is unreadable, holds several patches, or has no Emerald+ matches |
| 4 | Data Dragon is unreachable or has no version for the patch |
| 5 | A champion in the matches is unknown to Data Dragon |

Nothing is written unless every step succeeded.

## Testing

- **Statistics** (pure functions, synthetic matches): games, wins and rates per champion and role; the smoothing formula; the 30-game threshold; pick and ban rates, including a ban by either team counting once; only Emerald+ matches kept.
- **Command:** a synthetic collection database and an injected Data Dragon fetch; both files written in the documented format; each exit code; nothing written on failure.
- **Seed script** (`scripts/build-seed-data.test.mjs`): with a stats file, `champion_stats` rows come from it with `ranking_win_rate` and the `opgg_cache` delete; without one, output is unchanged.
- **Site:** the route and page tests assert ordering by `ranking_win_rate`, and the dossier label.

## Follow-Up Work

1. **Real matchups** from the same database, replacing the February counters (the next project).
2. **More matches**: every extra collection run makes the statistics less noisy and admits more champions per role; rerunning the command and reseeding is all it takes.
