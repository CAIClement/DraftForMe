# DraftForMe Repo Cleanup Design

Date: 2026-05-19

## Summary

Clean the repository around the active Next.js/Supabase application while preserving the new ML pipeline for future site integration.

## Active Project Surface

Keep the current production direction:

- `src/` Next.js app, API routes, components, Supabase helpers, recommendation engine, and tests.
- `supabase/` migrations and seed SQL.
- `scripts/` seed tooling used by the Next/Supabase app.
- `data/` cache snapshots currently used to build Supabase seed data and support ML experiments.
- `ml/` and `test/ml/` ML pipeline, Hugging Face Space support, artifacts needed for local prediction, and tests.
- `recommendation.py`, currently used by `ml/build_dataset.py` to generate expert labels for training data.
- `docs/superpowers/` specs and plans.
- Node, TypeScript, Tailwind, Vitest, and Next configuration files.

## Cleanup Targets

Remove old runtime and prototype surfaces that are not imported by the current app:

- Flask runtime and static app files: `app.py`, `templates/`, `static/`, old root `requirements.txt`, and old root `test/test.py`.
- Orphaned OP.GG Selenium scraper: `opgg_scraper.py`. The current app and ML tests do not import it, and the repo no longer keeps its Selenium dependency set.
- Root prototype and design-canvas files: `app.jsx`, `index.html`, `landing-ambitieux.jsx`, `landing-hybride.jsx`, `landing-sobre.jsx`, `decision-space.jsx`, `design-canvas.jsx`, `tweaks-panel.jsx`, and `shared.jsx`.
- Generated files: Python `__pycache__/`, `.pytest_cache/`, Next dev logs, and other local build/test caches.

## ML Preservation

Keep the ML pipeline as first-class project code because it will be integrated into the site later. Preserve:

- `ml/*.py`, `ml/README.md`, `ml/requirements.txt`.
- `ml/space/` source files for the Hugging Face Space.
- `test/ml/*.py`.
- The current trained model metadata and model artifact if present.

Ignore generated ML caches and large rebuildable datasets where appropriate.

## Gitignore Updates

Update `.gitignore` so removed generated files do not come back:

- Python caches: `__pycache__/`, `*.py[cod]`, `.pytest_cache/`.
- Local envs: `.venv/`, `.venv-ml/`.
- ML generated dataset: `ml/artifacts/training_dataset.csv`.
- Keep existing Next, Node, Supabase temp, and local env ignores.

## Verification

After cleanup:

- Run `npm run test`.
- Run the ML test suite with `python -m pytest test/ml`.
- Run `git status --short` and confirm the diff contains only intended deletions, `.gitignore`, and the cleanup docs.
