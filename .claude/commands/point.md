---
description: Status check-in ("faire le point") — where things stand against .claude/work/current.md, git, and the suite.
---

Give a short status, in French (this is a check-in for the owner, not a spec):

1. Read `.claude/work/current.md` — what was supposed to be in progress.
2. `git status --short` and `git log --oneline -5` — what's actually changed since.
3. Whether the suite is currently green (run `npm run ci` and/or `python -m pytest test/ml -q` if it hasn't run recently in this session).
4. What's next, and anything blocking.

Keep it to what changed since the last check-in — don't re-explain the whole plan every time.
