---
description: Review the current diff against CLAUDE.md's guardrails and conventions before committing or shipping.
---

Dispatch the `reviewer` subagent on `git diff` (against `main`, or against the last commit if there's nothing staged/unstaged — say which). Show its findings as-is; don't soften or pre-filter them. If it finds nothing, say that plainly rather than padding the response.
