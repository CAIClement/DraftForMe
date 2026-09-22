# DraftForMe Claude Code Workflow Implementation Plan

**Goal:** Wire up the tooling described in the spec so a Claude Code session in this repository has working subagents, slash commands, rules, hooks, and CI, without touching how the site or the model behave.

**Spec:** `docs/superpowers/specs/2026-09-22-draftforme-claude-code-workflow-design.md`

**Executed directly in one session** (not handed to `subagent-driven-development`): every file here is either new or a small, independent addition to an existing one, so there is nothing to parallelize across tasks.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `eslint.config.mjs` | Flat ESLint config extending `next/core-web-vitals` and `next/typescript` |
| `.github/workflows/ci.yml` | `site` job (typecheck, lint, test, seed check) and `ml` job (pytest) |
| `.claude/settings.json` | Permission allowlist and hook registration |
| `.claude/agents/explorer.md` | Haiku, read-only code location |
| `.claude/agents/architect.md` | Sonnet, high effort, spec-to-plan |
| `.claude/agents/test-runner.md` | Haiku, runs both suites, reports pass/fail |
| `.claude/agents/reviewer.md` | Sonnet, reviews a diff against CLAUDE.md |
| `.claude/commands/feature.md` | Start a spec for new feature work |
| `.claude/commands/fix.md` | Start a spec for a bug fix |
| `.claude/commands/table.md` | Show current Supabase schema and recent migrations |
| `.claude/commands/idee.md` | Add an idea to `.claude/work/backlog.md` |
| `.claude/commands/backlog.md` | Triage `.claude/work/backlog.md` |
| `.claude/commands/point.md` | Status check-in against `.claude/work/current.md` |
| `.claude/commands/pause.md` | Checkpoint the current session into `.claude/work/current.md` |
| `.claude/commands/review.md` | Run the reviewer subagent on the current diff |
| `.claude/commands/commit.md` | Stage and commit the current step |
| `.claude/commands/ship.md` | Finish a branch: suite green, PR opened |
| `.claude/commands/explain.md` | Explain a piece of code in French |
| `.claude/rules/security.md` | Always active: API key, Supabase, production guardrails |
| `.claude/rules/typescript.md` | typedRoutes, tsc, pure-function conventions |
| `.claude/rules/supabase.md` | Query symmetry, generated seed, migrations |
| `.claude/rules/ui.md` | Color tokens, French text, hide-don't-invent |
| `.claude/rules/testing.md` | Test placement, Vitest, Python flat tests, cp1252 |
| `.claude/rules/nextjs/app-router.md` | App Router only, `Route` typing |
| `.claude/hooks/session-start.mjs` | Branch, worktree-holds-main warning, current.md |
| `.claude/hooks/lint-file.mjs` | ESLint --fix after Edit/Write on JS/TS files |
| `.claude/work/backlog.md` | Seeded empty, with the triage convention `/backlog` expects |
| `.claude/work/current.md` | Seeded empty, with the format `/pause` and `/point` expect |

**Modified**

| File | Change |
|---|---|
| `package.json` | Add `ci`, `lint:fix`, `test:ml`, `seed:check`; add `eslint`, `eslint-config-next`, `@eslint/eslintrc` dev dependencies |
| `CLAUDE.md` | New "Claude Code tooling" section pointing at the agents, commands, rules and hooks |

## Steps

1. **ESLint.** Add the three dev dependencies, write `eslint.config.mjs`, confirm `npm run lint` runs non-interactively and reports no errors on the current source.
2. **package.json scripts.** Add the four scripts; confirm `npm run ci` and `npm run seed:check` both succeed on a clean tree.
3. **CI workflow.** Write `.github/workflows/ci.yml` with the `site` and `ml` jobs.
4. **Hooks.** Write `session-start.mjs` and `lint-file.mjs`; register both in `.claude/settings.json` along with a small permission allowlist for the read-only and test commands a session runs constantly.
5. **Subagents.** Write the four files under `.claude/agents/`.
6. **Rules.** Write the six files under `.claude/rules/` (five plus `nextjs/app-router.md`), each scoped to what actually exists in this repository.
7. **Commands.** Write the eleven files under `.claude/commands/`.
8. **Work tracking.** Seed `.claude/work/backlog.md` and `current.md` empty, in the format the new commands read and write.
9. **CLAUDE.md.** Add the pointer section; do not otherwise change the file.
10. **Verify.** `npm run ci`, `python -m pytest test/ml -q`; confirm both pass, then report the file list to the owner instead of committing (CLAUDE.md's small-commit convention is for the owner to trigger, not assumed here).

## Conventions for this work

- Code, identifiers and file content in English; anything the owner reads directly (this document, the spec) may stay in English since it is a design document, not product text — French is for user-facing site copy per CLAUDE.md.
- No change to `src/lib/recommendation/`, `supabase/seed.sql`'s generated content, or any query in `load-example.ts` / `route.ts`.
- Nothing here touches the production Supabase project.
