---
description: Start a bug fix — reproduce first, spec only if the fix isn't obvious once reproduced.
---

Bug: $ARGUMENTS

1. Reproduce it before touching code: a failing test if one is feasible, or the exact steps/output otherwise.
2. If the fix is small and localized once you understand the bug, skip the spec — CLAUDE.md's "spec, then plan" is for non-trivial work, and a one-file fix isn't that. Branch from `main`, fix it, add a regression test, run `npm run ci` or `python -m pytest test/ml -q` as appropriate.
3. If the fix touches how the recommendation engine scores, how a migration applies, or spans multiple files with real design choices, treat it like `/feature` instead — write a spec first.
