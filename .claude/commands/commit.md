---
description: Stage and commit the current step, in this project's small-steps convention.
---

1. `git status` and `git diff` to see what's actually changed — don't assume.
2. Confirm the suite is green for what changed (site: `npm run ci`; ml: `python -m pytest test/ml -q`) before committing, per CLAUDE.md's "the suite passes at every commit."
3. Stage only the files belonging to this step — not an unrelated broad `git add -A`.
4. Commit with a message starting `feat:`, `fix:`, `docs:`, or `test:`, describing this one step, not the whole feature.
5. Only commit when the owner has actually asked for a commit in this conversation — don't run this command speculatively.
