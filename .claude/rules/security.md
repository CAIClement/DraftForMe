---
active: always
---

# Security

Always relevant in this repository, regardless of which files are touched.

- **The Riot API key never touches disk.** Read it from `RIOT_API_KEY` only — no `.env`, no file, no pasting it into a conversation or a commit. Never run anything against the real Riot API; that's the owner's action.
- **The collection database is read-only outside a running collection.** It lives at `%LOCALAPPDATA%\DraftForMe\matches.sqlite`, outside OneDrive. `ml.win` and any analysis code open it `?mode=ro`; never open it for writing.
- **`ml.win.test` evaluates the test set once.** `test_report.json` is the lock — `ml.win.select` refuses to run after it exists. Never delete that report or rerun the evaluation to get a better number. Trial runs go in a separate `--artifacts` directory.
- **The production Supabase project is touched only when the owner asks** — no push, deploy, migration, or query against it as a side effect of other work.
- **Never introduce command injection, XSS, or SQL injection.** `scripts/build-seed-data.mjs` builds raw SQL strings from `data/`; any new field going through it needs the same escaping (`sql()`/`numberOrNull()`) as the existing ones, not string interpolation.
