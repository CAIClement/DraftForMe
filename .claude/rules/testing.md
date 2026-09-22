---
active: paths
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "test/ml/**"
---

# Testing

- Site tests sit next to the code they test (`*.test.ts(x)`), not in a parallel `__tests__/` tree.
- Python tests are flat in `test/ml/`, named `test_*.py`. `test/ml/` has no `__init__.py`, so pytest puts it on `sys.path` — import helpers by bare name (`from win_fixtures import ...`, `from win_command_fixtures import ...`), not a package path.
- **Python command output must be cp1252-safe**: no arrows, no typographic quotes — the owner runs these in a Windows console. Every expected failure ends with a French message and a documented exit code, never a bare traceback.
- The suite passes at every commit: `npm test` (site) and `python -m pytest test/ml -q` (ml) before calling anything done. `npm run ci` covers typecheck, lint and the site suite in one command.
- Vitest excludes `**/.claude/**` — an agent worktree under `.claude/worktrees/` carries its own `node_modules` and must not be collected by a bare `vitest run` in the primary checkout.
