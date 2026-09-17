"""Command: python -m ml.win.select --db <matches.sqlite> [--seed 42]

Splits the matches, trains every candidate on the training set, chooses on validation, and
saves the chosen model with a validation report. The test set is never evaluated here:
that is ml.win.test, which runs once.

Exit codes:
  0  finished
  2  invalid arguments, or the database does not exist
  3  the database is unusable (several patches, or too few matches)
  4  supabase/seed.sql is missing or unreadable
  5  the test set has already been evaluated, so choosing again is refused
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

import joblib

from ml.paths import SEED_SQL_PATH, WIN_ARTIFACT_DIR
from ml.win.baselines import ChampionPrior, References, SeedDataError, champions_missing_from_engine, load_engine_data
from ml.win.data import (
    DatasetRejected,
    MissingDatabaseError,
    load_matches,
    split_matches,
    subset,
    to_dataset,
    write_split,
)
from ml.win.metrics import summary
from ml.win.models import DraftModel, LogisticDraftModel, candidate_models, select_model

SPLIT_FILE = "split.json"
MODEL_FILE = "model.joblib"
WEIGHTS_FILE = "model_weights.json"
VALIDATION_REPORT_FILE = "validation_report.json"
TEST_REPORT_FILE = "test_report.json"


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entraîne les modèles de victoire et choisit le meilleur sur la validation.")
    parser.add_argument("--db", required=True, help="base SQLite de la collecte")
    parser.add_argument("--seed", type=int, default=42, help="graine du découpage et du masquage")
    parser.add_argument("--artifacts", default=str(WIN_ARTIFACT_DIR), help="dossier des fichiers produits")
    parser.add_argument("--seed-sql", default=str(SEED_SQL_PATH), help="données du moteur du site")
    return parser.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    out: Callable[[str], None] = print,
    candidates_factory: Callable[[int, ChampionPrior], Sequence[DraftModel]] = candidate_models,
) -> int:
    args = parse_args(argv)
    artifacts = Path(args.artifacts)

    if (artifacts / TEST_REPORT_FILE).is_file():
        out("Le jeu de test a déjà été évalué : choisir un nouveau modèle maintenant fausserait le résultat.")
        out(f"Pour tout recommencer volontairement, supprime le dossier {artifacts}.")
        return 5

    try:
        frame = load_matches(args.db)
    except MissingDatabaseError:
        out(f"Base introuvable : {args.db}")
        return 2
    except DatasetRejected as error:
        out(f"Base inutilisable : {error}.")
        return 3

    try:
        engine_data = load_engine_data(Path(args.seed_sql))
    except SeedDataError as error:
        out(f"Données du moteur illisibles : {error}.")
        return 4

    try:
        artifacts.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        out(f"Impossible de créer le dossier {artifacts} : {error}.")
        return 2

    patch = str(frame["patch"].iloc[0])
    split = split_matches(frame, args.seed)
    write_split(artifacts / SPLIT_FILE, split, seed=args.seed, patch=patch, db_path=Path(args.db).resolve())
    train = to_dataset(subset(frame, split.train))
    validation = to_dataset(subset(frame, split.validation))
    out(
        f"Patch {patch} : {len(train)} parties d'entraînement, {len(validation)} de validation, "
        f"{len(split.test)} de test mises de côté."
    )

    prior = ChampionPrior(engine_data)
    out("Modèles candidats (log loss de validation) :")
    best, rows = select_model(train, validation, candidates_factory(args.seed, prior), log=out)

    references = References(engine_data).fit(train.drafts, train.labels)
    reference_rows = [
        {"model": name, "kind": "reference", **summary(validation.labels, probabilities)}
        for name, probabilities in references.predict(validation.drafts).items()
    ]
    out("Références :")
    for row in reference_rows:
        out(f"  {row['model']} : log loss {row['log_loss']:.4f}")

    report = {
        "patch": patch,
        "seed": args.seed,
        "splits": {"train": len(train), "validation": len(validation), "test": len(split.test)},
        "chosen": best.name,
        "candidates": rows,
        "references": reference_rows,
        "missing_from_engine": champions_missing_from_engine(train.drafts, engine_data),
    }
    (artifacts / VALIDATION_REPORT_FILE).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    joblib.dump({"model": best, "patch": patch, "seed": args.seed}, artifacts / MODEL_FILE)

    weights_path = artifacts / WEIGHTS_FILE
    if isinstance(best, LogisticDraftModel):
        weights_path.write_text(json.dumps(best.weights()), encoding="utf-8")
    elif weights_path.exists():
        weights_path.unlink()

    out(f"Modèle retenu : {best.name}")
    out("Évaluation finale, une seule fois : python -m ml.win.test")
    return 0


if __name__ == "__main__":
    sys.exit(main())
