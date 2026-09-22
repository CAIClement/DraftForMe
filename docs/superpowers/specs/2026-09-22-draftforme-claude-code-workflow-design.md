# DraftForMe Claude Code Workflow Design

Date: 2026-09-22

## Summary

Give Claude Code, working in this repository, the tooling CLAUDE.md already describes in prose but nothing enforces: subagents scoped to the tasks this project actually has (explore, plan, run tests, review), slash commands for the recurring steps of the CLAUDE.md workflow (spec, plan, commit, ship), a CI workflow that runs the commands CLAUDE.md documents, and hooks that keep a session honest about which branch and worktree it is in.

## Why

- **The workflow is written down but not run.** CLAUDE.md says work starts with a spec and a plan, branches from `main`, commits in small steps, and keeps the suite green. Nothing checks any of that; it depends on whoever is driving remembering to do it.
- **`main` is not always where a session expects it.** This checkout keeps `main` in a sibling worktree at `.claude/worktrees/`, so a session on a feature branch can be looking at a stale `main` if it assumes the primary checkout has it. A session-start hook can say so before anything runs.
- **There is no CI.** `npm test`, `npx tsc --noEmit`, `npm run lint` and `python -m pytest test/ml -q` all exist and are documented, but nothing runs them on a push or a PR; a broken suite is only caught when someone runs it locally.
- **`npm run lint` does not currently work non-interactively.** No ESLint config exists in the repository (`next lint` prompts to create one). Any CI step that lints needs that fixed first.

## Decisions

| Question | Decision |
|---|---|
| Subagents | Four, matched to real recurring tasks: `explorer` (Haiku, read-only) for locating code, `architect` (Sonnet, high effort) for turning a spec into a plan, `test-runner` (Haiku) for running the site and ml suites and reporting pass/fail, `reviewer` (Sonnet) for checking a diff against CLAUDE.md's conventions and guardrails before it ships |
| Slash commands | Named for the CLAUDE.md workflow steps rather than invented generically: `/feature` and `/fix` start a spec for new work or a bug; `/table` looks up the current Supabase schema (`champion_stats`, `counter_relations`, migrations) before touching a query; `/idee` and `/backlog` capture and triage ideas in `.claude/work/backlog.md`; `/point` and `/pause` check in on and checkpoint `.claude/work/current.md`; `/review`, `/commit` and `/ship` cover the end of a change; `/explain` answers a question about the code in French, for the owner |
| Rules directory | Reference material under `.claude/rules/`, one file per concern (security, TypeScript, Supabase, UI, testing, App Router), linked from CLAUDE.md. Claude Code has no built-in mechanism to auto-load a rule file only when matching files are touched, so this is documentation Claude is expected to consult, not an enforced gate. `pages-router.md` is dropped: the project has no Pages Router code for it to apply to |
| Hooks | `session-start.mjs` prints the current branch, whether `main` lives in a sibling worktree, and the contents of `.claude/work/current.md` if present. `lint-file.mjs` runs after an Edit or Write on a `.ts`/`.tsx`/`.js`/`.jsx` file and auto-fixes it with ESLint, reporting failures back to the session |
| CI | One GitHub Actions workflow, two jobs: `site` (`npm ci`, typecheck, lint, test, and a check that `supabase/seed.sql` is still exactly what the generator produces) and `ml` (`pip install -r ml/requirements.txt`, `pytest test/ml -q`). No Riot API key is available in CI and none of these commands need one |
| ESLint | Add `eslint`, `eslint-config-next` and `@eslint/eslintrc` as dev dependencies and a flat `eslint.config.mjs` extending `next/core-web-vitals` and `next/typescript`, matching what `create-next-app` generates for this Next version. Without this, `npm run lint` cannot run outside an interactive terminal |
| package.json scripts | Four additions: `ci` (typecheck + lint + test, the single entry point CI and a future pre-push hook both use), `lint:fix` (what the lint-file hook calls), `test:ml` (the Python suite, reachable the same way as the site's), `seed:check` (regenerates `supabase/seed.sql` and fails if it differs from what is committed, enforcing "generated, never edit by hand" in CI) |

## Scope

- **In:** the four subagents, the eleven slash commands, the rules directory, the two hooks, `.claude/settings.json` wiring them up, the CI workflow, the ESLint config and its dependencies, four `package.json` scripts, `.claude/work/backlog.md` and `current.md` seeded empty, and a short new section in CLAUDE.md pointing at all of it.
- **Out:** changing how the recommendation engine scores, touching the production Supabase project, a hook that enforces the spec-then-plan workflow by blocking tool use (the rules directory documents it; nothing yet gates it), and a pre-commit git hook (CI covers the same commands on push).
