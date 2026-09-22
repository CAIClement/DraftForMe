---
description: Start new feature work with a spec, per CLAUDE.md's workflow.
---

Start a spec for: $ARGUMENTS

1. Confirm you're not on `main` — branch from it first if you are (check `git worktree list` too: `main` may live in a sibling worktree, see `.claude/hooks/session-start.mjs`'s note if it printed one).
2. Dispatch the `architect` subagent to turn this into a spec in `docs/superpowers/specs/`, following the existing files' format (Summary, Why, Decisions table, Scope).
3. Show the spec and ask before writing a plan — don't chain straight into `architect` writing the plan too without a look-over.
