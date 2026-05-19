# DraftForMe Repo Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove obsolete legacy app/prototype/generated files while keeping the active Next.js/Supabase app and future ML integration work.

**Architecture:** Treat `src/`, `supabase/`, `scripts/`, `data/`, `ml/`, and `test/ml/` as active surfaces. Delete old root-level Flask/static/prototype surfaces and generated caches. Add ignore rules for files that should be regenerated locally rather than versioned.

**Tech Stack:** Next.js, TypeScript, Supabase, Vitest, Python, pytest, scikit-learn ML pipeline.

---

## File Structure

- Modify `.gitignore`: add Python cache, pytest cache, virtualenv, and ML dataset ignore rules.
- Delete legacy Flask/static files: `app.py`, `templates/`, `static/`, `requirements.txt`, `test/test.py`.
- Delete orphaned scraper file: `opgg_scraper.py`.
- Delete root prototypes: `app.jsx`, `index.html`, `landing-ambitieux.jsx`, `landing-hybride.jsx`, `landing-sobre.jsx`, `decision-space.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx`, `shared.jsx`.
- Keep active ML label scorer: `recommendation.py`.
- Delete generated caches/logs: `__pycache__/`, `ml/**/__pycache__/`, `test/ml/__pycache__/`, `.pytest_cache/`, `.next-dev-3010.log`, `.next-dev-3010.err`.
- Preserve ML source, ML tests, current model artifacts, Next/Supabase app code, seed data, and docs.

### Task 1: Update Ignore Rules

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add generated Python and ML rules**

Ensure `.gitignore` contains:

```gitignore
__pycache__/
*.py[cod]
.pytest_cache/
.venv/
.venv-ml/
ml/artifacts/training_dataset.csv
```

- [ ] **Step 2: Verify ignore behavior**

Run:

```powershell
git status --short --ignored
```

Expected: Python caches, pytest cache, Next outputs, and `ml/artifacts/training_dataset.csv` appear as ignored or removed from the tracked set after cleanup.

### Task 2: Remove Legacy And Prototype Files

**Files:**
- Delete: `app.py`
- Delete: `templates/index.html`
- Delete: `static/css/style.css`
- Delete: `static/js/app.js`
- Delete: `requirements.txt`
- Delete: `test/test.py`
- Delete: `opgg_scraper.py`
- Delete: `app.jsx`
- Delete: `index.html`
- Delete: `landing-ambitieux.jsx`
- Delete: `landing-hybride.jsx`
- Delete: `landing-sobre.jsx`
- Delete: `decision-space.jsx`
- Delete: `design-canvas.jsx`
- Delete: `tweaks-panel.jsx`
- Delete: `shared.jsx`

- [ ] **Step 1: Delete obsolete files**

Remove the listed files and empty directories left behind by `templates/`, `static/`, and root `test/` if they contain no kept ML tests.

- [ ] **Step 2: Confirm no active imports reference deleted files**

Run:

```powershell
rg "app\\.py|recommendation\\.py|opgg_scraper\\.py|static/|templates/|landing-|design-canvas|tweaks-panel|shared\\.jsx" -n -g "!node_modules" -g "!.git"
```

Expected: matches may remain only in cleanup docs or historical docs, not in active `src/`, `scripts/`, `ml/`, or tests.

### Task 3: Remove Generated Caches

**Files:**
- Delete: `__pycache__/`
- Delete: `ml/__pycache__/`
- Delete: `ml/space/__pycache__/`
- Delete: `test/ml/__pycache__/`
- Delete: `.pytest_cache/`
- Delete: `.next-dev-3010.log`
- Delete: `.next-dev-3010.err`

- [ ] **Step 1: Delete generated caches and logs**

Remove the listed directories and log files.

- [ ] **Step 2: Confirm generated files are gone or ignored**

Run:

```powershell
git status --short --ignored
```

Expected: generated caches/logs should not remain as untracked files.

### Task 4: Verify Active Surfaces

**Files:**
- No file changes expected.

- [ ] **Step 1: Run Next/Vitest tests**

Run:

```powershell
npm run test
```

Expected: all TypeScript tests pass.

- [ ] **Step 2: Run ML tests**

Run:

```powershell
python -m pytest test/ml
```

Expected: all ML tests pass, or report missing Python dependencies if the ML environment is not installed.

- [ ] **Step 3: Review final diff**

Run:

```powershell
git status --short
```

Expected: status shows intended deletions, `.gitignore` modification, and cleanup docs only, while `ml/` source and `test/ml/` remain.

## Self-Review

Spec coverage:

- Preserves active Next/Supabase app: Task 4 verifies `src/` tests.
- Preserves ML for future integration: file structure explicitly keeps `ml/` and `test/ml/`; Task 4 runs ML tests.
- Removes obsolete Flask/static/prototype surfaces: Task 2.
- Removes generated caches/logs and prevents recurrence: Tasks 1 and 3.

Placeholder scan:

- No placeholder work items remain.

Type consistency:

- This plan only changes repository shape and ignore rules, so no runtime type signatures are introduced.
