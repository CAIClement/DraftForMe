# DraftForMe Match Collection Design

Date: 2026-09-17

## Summary

Collect real ranked League of Legends matches from the Riot API into a local dataset, so that a win-probability model can later be trained on what actually wins rather than on hand-written rules.

This is project 1 of 3. It produces a dataset and nothing else: no model, no change to the website.

## Why This Exists

The goal of DraftForMe is to suggest the best champions for a draft. Today the site ranks champions with a rule-based engine (`src/lib/recommendation/engine.ts`): a champion's global win rate, three known counters per champion, and weights chosen by hand. It knows nothing about team synergies and very little about matchups.

The existing machine-learning pipeline in `ml/` does not improve on that. `ml/build_dataset.py` calls `compute_champion_score` from `recommendation.py` and uses its output as the training target, so the model learns to reproduce the rules — with a mean absolute error of 5.77 on top. By construction it cannot beat what it imitates.

A model can only find better picks if it learns from ground truth: which drafts won. The repository contains no such data — only aggregated OP.GG statistics and seven player profiles. This project collects it.

### Directions considered and set aside

- **A conversational LLM coach.** Explored first, then dropped: an LLM explains and rephrases, but does not make the recommendations better. It would talk about the same champions the engine already picks.
- **User accounts.** Only needed to protect the cost of an LLM. With the coach dropped, no account is required.
- **Fine-tuning or hosting a language model for free.** Training data does not exist, and hosting inference for a public site is the part that is not free.

## The Three Projects

| # | Project | Delivers | Live on the site |
|---|---|---|---|
| 1 | **Collection** (this spec) | A dataset of real ranked drafts with the winner | No — runs locally |
| 2 | **Training and evaluation** | A win-probability model, compared against the current rule engine on matches it has never seen | No |
| 3 | **Integration** | The site uses the model, with the rule engine as fallback | Only after Riot approval |

Project 2 is the decision point. If the model does not beat the rules on held-out matches, the work stops there without the website having been touched.

## Riot Policy Constraints

Verified against Riot's published policies:

- **Every public product must be registered.** "All products must be registered in, and audited by Riot Games through the Developer Portal." This applies to DraftForMe already, with or without a model.
- **Pick-recommendation products are permitted** when they "give multiple choices", do not "remove game decisions", and do not create an unfair advantage. DraftForMe proposes three explained options outside the game client. Project 3 must keep that true: the model must never impose a single pick.
- **Personal keys cover "personal research".** Collecting matches and training locally is within that. Personal and development keys may not be used "for public consumption".
- **Development keys expire every 24 hours.** Rate limits for development and personal keys are 20 requests per second and 100 requests every two minutes, enforced per region.

Not verified: the general policy does not address training models on API data, and the API Terms and Conditions page was not accessible. Whether a model trained on this data may power the public site must be confirmed with Riot through the product registration, before project 3 activates anything.

Sources: [General Policies](https://developer.riotgames.com/policies/general), [API keys and rate limits](https://developer.riotgames.com/docs/portal), [RSO](https://support-developer.riotgames.com/hc/en-us/articles/22801670382739-RSO-Riot-Sign-On).

## Scope

- **Region:** EUW.
- **Queue:** ranked solo/duo only (queue id 420).
- **Elo:** all ranks, Iron through Challenger, sampled in equal shares.
- **Patch:** the current patch only.
- **Volume:** about 30,000 matches, 3,000 per rank. Enough to learn whether a model beats the rules. If the result is promising but marginal, collection resumes and extends the same dataset.

### Non-goals

- Training or evaluating any model (project 2).
- Any change to the website or to Supabase (project 3).
- Refreshing the statistics the site currently displays.
- Registering the product with Riot or obtaining a production key — both are actions for the owner of the Riot developer account.

## Sampling

Sampling players at random would let Silver and Gold, where most players are, dominate the dataset. Instead each of the ten ranks — Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Challenger — receives an equal quota of 3,000 matches.

Players are drawn per rank **in batches of 50 until the quota is met or the rank is exhausted**, rather than as a fixed count, because the number of current-patch matches per player varies widely. Iron through Diamond are listed page by page across their four divisions; Master, Grandmaster and Challenger each have a single league listing.

Draws use a seeded random generator (`--seed`) so a run can be reproduced.

### Elo label is an approximation

The match API does not return participants' ranks, and fetching them would cost ten more requests per match. Each match is therefore labelled with **the rank of the player through whom it was found** (`seed_tier`). Ranked matchmaking groups players of similar rating, so this is a reasonable proxy — but it is a proxy, and project 2 must treat it as one.

When the same match is reachable through players of two different ranks, the first seed to reach it wins the label.

### Known sampling limits

To verify during the real run, and to carry into project 2:

- Players are drawn from the first pages of each division's listing. If Riot orders league entries by LP, the sample leans towards the top of each division rather than spreading evenly across it.
- One seed player can contribute all of their current-patch matches, so a single prolific player can dominate their rank's share.
- Seed players in the extreme tiers (Iron, Challenger) carry survivorship bias: reaching those tiers already selects for unusual players. `match_ids.seed_puuid` is stored precisely so the training project can cap or reweight matches per seed.
- The seed makes a draw reproducible only for the same league listings, in an uninterrupted run. It does not make the whole dataset rebuildable: listings change over time, and a resumed run restarts the random generator from the same seed against a store that already holds prior draws, which is not the same as replaying the original sequence.

## Architecture

A package `ml/collect/`, following the conventions of `ml/`: constants in `ml/paths.py`, tests in `test/ml/`.

| Module | Responsibility | Depends on |
|---|---|---|
| `riot_client.py` | HTTP calls to the Riot API: routing to `euw1` for league endpoints and `europe` for match endpoints; key read from `RIOT_API_KEY`; rate limiting per routing host; 429 handling | `httpx` |
| `sampling.py` | The sampling plan: ranks, per-rank quotas, batch sizes | nothing |
| `extract.py` | A pure function turning a raw match into a compact row, and deciding whether a match is valid | nothing |
| `store.py` | SQLite persistence and resume state | `sqlite3` |
| `collect.py` | The three-phase collection loop, written against a `MatchSource` protocol so it can be tested with a fake | `extract`, `sampling`, `store`, `riot_client` errors |
| `run.py` | Command-line entry point: arguments, key check, patch detection, final summary | `collect`, `riot_client`, `store` |

Command:

```
python -m ml.collect.run --target 30000 [--patch <major.minor>] [--seed 42] [--db <path>]
```

`--patch` is normalised to `major.minor`: `16.08` gives `16.8`, `16.18.1` gives `16.18`; a value that does not parse this way is rejected before anything runs. `--target` must be at least the number of tiers (10), so every tier gets at least one match.

`httpx` is added to `ml/requirements.txt`.

### The key never touches the disk

`RIOT_API_KEY` is read from the process environment only. There is no `.env` file for it: a key written into a file eventually ends up in a commit. The owner sets it in the shell session before running. If the variable is missing, the command exits immediately with an explanation.

### Patch detection

The target patch defaults to the first two segments of the newest version listed by Data Dragon (`https://ddragon.leagueoflegends.com/api/versions.json`, no key required). For example, a newest version of `16.18.1` targets patch `16.18`. `--patch` overrides it.

A match belongs to the target patch when the first two segments of its `gameVersion` match. Match ids for a player are returned newest first, so the first match from an older patch ends collection for that player instead of spending requests on everything behind it.

### Rate limiting

Riot's development-key limits are 20 requests per second and 100 requests every two minutes, per routing value. The limiter enforces both as sliding windows, but pads them slightly — 1.1 s and 121 s — because the Windows monotonic clock is coarse and the timestamp is taken before the request is sent, so a padded window keeps a burst from landing on Riot's exact edge.

The limiter's state lives in memory only: it does not persist across restarts. A 429 received right after a restart, before the limiter has relearned the pace, is still handled correctly by waiting for the `Retry-After` delay Riot returns with it.

## Storage

A single SQLite database at `ml/artifacts/matches.sqlite` (`MATCHES_DB_PATH` in `ml/paths.py`, overridable with `--db`), ignored by git along with its `-journal`, `-wal` and `-shm` files.

Saving a match surfaces any constraint violation instead of silently ignoring it; the one conflict that is intentionally ignored is a duplicate `match_id`, which the resume logic relies on.

**`players`** — `puuid` (primary key), `summoner_id` (kept when league entries identify players by summoner id, so an already-drawn player is recognised before conversion), `tier`, `division`, `sampled_at`, `ids_status` (`pending`, `done`, `failed`).

**`match_ids`** — `match_id` (primary key), `seed_tier`, `seed_puuid`, `position` (0 is the seed player's newest match; it is what lets an older-patch match end collection for that player), `status` (`pending`, `done`, `skipped_patch`, `skipped_invalid`, `not_found`, `failed`), `attempts`. A downloaded payload whose own `metadata.matchId` disagrees with the id it was requested under is marked `skipped_invalid` under the requested id, rather than saved under the wrong id or left pending forever. A `failed` match is retried automatically at the start of the next run, up to 3 attempts in total; beyond that it stays `failed`.

**`matches`** — one row per valid match:

| Column | Content |
|---|---|
| `match_id` | primary key |
| `patch` | `major.minor`, e.g. `16.18` |
| `game_version` | full version string |
| `game_creation` | epoch milliseconds |
| `game_duration` | seconds |
| `seed_tier` | rank label, see above |
| `blue_top` … `blue_support` | champion ids, one column per position |
| `red_top` … `red_support` | champion ids, one column per position |
| `blue_bans`, `red_bans` | JSON arrays of champion ids |
| `blue_win` | 1 or 0 |
| `raw_gzip` | the full match response, gzip-compressed |

The raw response is kept, at an estimated 150 MB for 30,000 matches, so that project 2 can extract a field this project did not — pick order, for instance — without repeating twelve hours of collection.

Riot's `teamPosition` values map as `TOP → top`, `JUNGLE → jungle`, `MIDDLE → mid`, `BOTTOM → adc`, `UTILITY → support`.

**`league_cursors`** — `tier`, `division` (primary key together), `next_page`, `exhausted`. Records how far each division's listing has been read, so a resumed run does not re-read pages it has already drawn from.

### Location for the full multi-hour run

`ml/artifacts/` sits inside the repository, which for this owner is inside a OneDrive-synced folder. OneDrive can lock a database file mid-write during a long run. For the full collection run, pass `--db` pointing outside OneDrive, for example:

```
--db "$env:LOCALAPPDATA\DraftForMe\matches.sqlite"
```

This is a recommendation for that run, not a change to the default: `MATCHES_DB_PATH` is unchanged.

## Collection Flow

Three phases, each resumable from the state in SQLite:

1. **Draw players.** For each rank below its quota, list players and draw a batch.
2. **List their matches.** Fetch each drawn player's 100 most recent ranked solo match ids (`queue=420`, `count=100`) and insert them, ignoring ids already present.
3. **Download and extract.** Fetch each pending match, filter by patch, validate, extract, store.

Phases repeat until every rank reaches its quota or runs out of players. Stopping the command at any moment, including abruptly, loses nothing: completed work is committed as it happens and a restart continues from the recorded state.

Progress is printed per rank, so a rank falling behind is visible during the run.

### Valid match

A match is stored only if all of the following hold. Otherwise it is marked `skipped_invalid` — never left to crash the run:

- `queueId` is 420
- the game did not end in an early surrender (remake)
- the game was not aborted: `endOfGameResult`, when present, is `GameComplete`
- there are exactly ten participants, five per team
- every participant has a non-empty `teamPosition`, and no position is repeated within a team
- exactly one team is recorded as the winner
- the payload is well-formed: no required field is missing or null

## Error Handling

| Situation | Behaviour |
|---|---|
| **Key expired or invalid** (401 or 403) | Stops cleanly with: key expired, regenerate it on the developer portal and rerun. Nothing is lost. |
| **Rate limit exceeded** (429) | Waits for the `Retry-After` delay, then continues |
| **Riot server error** (5xx) **or network error** (timeout, connection failure) | Retried with exponential backoff — 2, 4, 8, 16, 32, 60 s (about two minutes) — before giving up. A match download that still fails is marked `failed` and skipped. A league listing, a player's match-id listing, or a summoner-id to puuid conversion that still fails stops the command cleanly with exit code 4 and a message; nothing is marked `failed`, and the run resumes from where it stopped |
| **A match stays `failed` across a restart** (for example a long outage that outlasted the backoff for every pending match) | At the start of each run, every `failed` match with fewer than 3 recorded attempts is put back to `pending` and downloaded again; one that has failed 3 times stays `failed` |
| **Match not found** (404) | Marked `not_found`, never retried |
| **Malformed payload, or a downloaded payload whose own `metadata.matchId` disagrees with the id it was requested under** | Marked `skipped_invalid` and skipped; never saved under the wrong id and never retried forever |
| **Rank cannot reach its quota** (common for Challenger early in a patch) | Collection continues on the other ranks, and the final summary reports the imbalance explicitly |
| **`RIOT_API_KEY` missing** | Exits before any request, explaining how to set it |
| **Resuming on a different patch** (the database already holds matches from another patch) | Refused before any request is sent, with a message suggesting `--patch <stored patch>` to finish that patch, or a separate `--db` sibling of the one in use, for example `matches-16.19.sqlite` next to the current database, to collect the new one |

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Finished |
| 1 | Unexpected error with a Python traceback — for example an HTTP 404 on a league path, another unhandled 4xx such as 400, or an unexpected SQLite integrity or database error. The run is still resumable, but the same item may fail again on every restart |
| 2 | `RIOT_API_KEY` missing, or invalid arguments |
| 3 | Key expired or access refused (401 or 403) — the message prints the failing status and path, never the key |
| 4 | Persistent Riot server or network error |
| 5 | Patch mismatch, or patch detection failed (Data Dragon unreachable) |
| 6 | SQLite error (with a hint to move `--db` outside a OneDrive-synced folder) |
| 130 | Interrupted (Ctrl-C) |

## Unverified API Details

The Riot API reference is rendered client-side and could not be read, and available secondary sources disagree on one point that matters here: whether league entries return a player's `puuid` directly, or only a legacy `summonerId` that must be converted with an extra request before the match API can be called.

The design handles both. The decision is made per entry, not once for the whole response: `resolve_puuid` uses an entry's `puuid` when present, and converts its `summonerId` with one additional request only when it is not. That cost is negligible, since each player yields up to a hundred match ids.

The exact league endpoint paths and the match fields named in this document are to be confirmed against real responses during the first short run. Any mismatch is fixed in `riot_client.py` or `extract.py` alone, which is why those responsibilities are isolated.

## Testing

Unit tests in `test/ml/`, with no network access, against recorded or hand-written Riot responses:

- **Extraction:** a real anonymised match becomes the expected compact row; a remake, a non-420 queue, and a match with a missing or duplicated position are each rejected.
- **Sampling:** a 30,000 target produces ten quotas of 3,000; a rank that runs out of players does not stop the others.
- **Resume:** interrupting after some matches and restarting duplicates nothing and skips completed work.
- **Client:** a 401 raises the key-expired error; a 429 waits for `Retry-After` then retries; the 100-per-two-minutes window is respected; routing sends league calls to `euw1` and match calls to `europe`. Implemented with `httpx.MockTransport`.
- **Patch:** a match from an older patch is skipped and stops further collection for that player.

Then **a short real run by the owner**, `--target 20` with their key, which also probes the real response shapes and settles the `puuid` question above.

## Follow-Up Work

1. **Project 2 — training and evaluation.** Its spec must define the comparison against the rule engine on held-out matches before any model is trained.
2. **Project 3 — integration**, gated on Riot's answer about using a model trained on API data in the public product.
3. **Register DraftForMe on the Riot developer portal**, describing the model, which is also the path to a production key.
4. **Refresh the statistics the site displays.** The seeded data derives patch 16.3; the site states that honestly, but it is several months behind the live game.
