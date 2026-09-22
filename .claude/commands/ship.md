---
description: Finish a development branch — verify green, review, then ask how to integrate it.
---

1. Confirm the suite is fully green: `npm run ci` and, if `ml/` or `test/ml/` changed, `python -m pytest test/ml -q`.
2. Run `/review` (the `reviewer` subagent) on the full branch diff against `main`, not just the last commit.
3. Confirm `.claude/work/current.md` reflects this branch is done, or update it.
4. Present options — merge, open a PR, or further cleanup — and ask which; don't push, merge, or open a PR without the owner choosing. Never force-push, and never touch the production Supabase project as part of this.
