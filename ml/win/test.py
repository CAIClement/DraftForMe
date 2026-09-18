"""Command: python -m ml.win.test

Evaluates the chosen model and both references on the test set, once. The report is saved
with its date; while it exists, this command prints it again and recomputes nothing.

The verdict is decided on the interval computed with whole seed players resampled together
(`comparisons`): resampling by player instead of by match gives a wider, more honest interval
when the gap over a reference varies by player. The interval resampling individual matches
(`comparisons_by_match`) is kept in the report for information only.

Exit codes:
  0  finished, or the saved report was printed
  2  the database recorded by ml.win.select no longer exists
  3  the database no longer holds the recorded patch or every test match, or the saved
     report is corrupt
  4  supabase/seed.sql is missing or unreadable
  5  ml.win.select has not produced a model yet, or the saved model is unreadable
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ml.paths import SEED_SQL_PATH, WIN_ARTIFACT_DIR
from ml.win.baselines import References, SeedDataError, champions_missing_from_engine, load_engine_data
from ml.win.data import DatasetRejected, MissingDatabaseError, load_matches, read_split, subset, to_dataset
from ml.win.encoding import PICKS, TIER_GROUPS, hide_picks
from ml.win.metrics import calibration_table, paired_bootstrap, summary
from ml.win.models import LogisticDraftModel
from ml.win.select import MODEL_FILE, SPLIT_FILE, TEST_REPORT_FILE

PARTIAL_KNOWN_PICKS = (3, 5, 8)


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Évalue une seule fois le modèle retenu sur le jeu de test.")
    parser.add_argument("--artifacts", default=str(WIN_ARTIFACT_DIR), help="dossier des fichiers produits")
    parser.add_argument("--seed-sql", default=str(SEED_SQL_PATH), help="données du moteur du site")
    return parser.parse_args(argv)


def unseen_champions(train: np.ndarray, test: np.ndarray) -> int:
    """Distinct (role, champion) picks of the test set never seen in training."""

    def picks(drafts: np.ndarray) -> set[tuple[int, int]]:
        return {(index % 5, int(key)) for draft in drafts for index, key in enumerate(draft) if key}

    return len(picks(test) - picks(train))


def fmt(value: float | None, pattern: str) -> str:
    return "n/a" if value is None else format(value, pattern)


def print_report(report: dict[str, Any], out: Callable[[str], None]) -> None:
    out(f"Patch {report['patch']}, {report['matches']} parties de test, modèle : {report['chosen']}")
    rows = [("modèle", report["model"])] + list(report["references"].items())
    for name, result in rows:
        out(
            f"  {name} : log loss {result['log_loss']:.4f}, AUC {fmt(result['auc'], '.4f')}, "
            f"précision {fmt(result['accuracy'], '.1%')}"
        )
    for name, comparison in report["comparisons"].items():
        out(
            f"  écart avec {name} : {comparison['difference']:+.4f} "
            f"(IC 95 % de {comparison['low']:+.4f} à {comparison['high']:+.4f})"
        )
        by_match = report["comparisons_by_match"][name]
        out(
            f"  écart avec {name}, sans regrouper par joueur : {by_match['difference']:+.4f} "
            f"(IC 95 % de {by_match['low']:+.4f} à {by_match['high']:+.4f})"
        )
    if report["beats_references"]:
        out("Verdict : le modèle bat les trois références.")
    else:
        out("Verdict : le modèle ne bat pas les trois références.")


def reference_predictions(references: References, priors_reference: Any, drafts: np.ndarray, tiers: np.ndarray) -> dict[str, np.ndarray]:
    """The engine and win-rate references, plus the priors-only reference model's own predictions."""
    predictions = dict(references.predict(drafts))
    predictions[References.PRIORS_ONLY] = priors_reference.predict(drafts, tiers)
    return predictions


def evaluate(
    model: Any, references: References, priors_reference: Any, train: Any, test: Any, seed: int
) -> dict[str, Any]:
    model_probabilities = model.predict(test.drafts, test.tiers)
    reference_probabilities = reference_predictions(references, priors_reference, test.drafts, test.tiers)

    by_tier_group = {}
    groups = np.array([TIER_GROUPS[tier] for tier in test.tiers])
    for group in sorted(set(groups)):
        in_group = groups == group
        by_tier_group[group] = {"model": summary(test.labels[in_group], model_probabilities[in_group])}
        for name, probabilities in reference_probabilities.items():
            by_tier_group[group][name] = summary(test.labels[in_group], probabilities[in_group])

    partial_drafts = {}
    rng = np.random.default_rng(seed)
    for known in PARTIAL_KNOWN_PICKS:
        hidden = hide_picks(test.drafts, [PICKS - known] * len(test), rng)
        partial_drafts[str(known)] = {"model": summary(test.labels, model.predict(hidden, test.tiers))}
        for name, probabilities in reference_predictions(references, priors_reference, hidden, test.tiers).items():
            partial_drafts[str(known)][name] = summary(test.labels, probabilities)

    comparisons_by_match = {
        name: paired_bootstrap(test.labels, probabilities, model_probabilities, seed=seed)
        for name, probabilities in reference_probabilities.items()
    }
    comparisons = {
        name: paired_bootstrap(test.labels, probabilities, model_probabilities, groups=test.groups, seed=seed)
        for name, probabilities in reference_probabilities.items()
    }
    return {
        "chosen": model.name,
        "matches": len(test),
        "model": summary(test.labels, model_probabilities),
        "references": {name: summary(test.labels, probabilities) for name, probabilities in reference_probabilities.items()},
        "comparisons": comparisons,
        "comparisons_by_match": comparisons_by_match,
        "beats_references": all(comparison["low"] > 0 for comparison in comparisons.values()),
        "by_tier_group": by_tier_group,
        "partial_drafts": partial_drafts,
        "calibration": calibration_table(test.labels, model_probabilities),
        "unseen_champions": unseen_champions(train.drafts, test.drafts),
        "missing_from_engine": champions_missing_from_engine(test.drafts, references.engine_data),
        "top_weights": model.top_weights() if isinstance(model, LogisticDraftModel) else None,
    }


def main(
    argv: Sequence[str] | None = None,
    *,
    out: Callable[[str], None] = print,
    now: Callable[[], str] = lambda: datetime.now().isoformat(timespec="seconds"),
) -> int:
    args = parse_args(argv)
    artifacts = Path(args.artifacts)
    report_path = artifacts / TEST_REPORT_FILE

    if report_path.is_file():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as error:
            out(f"{report_path} est corrompu ({error}). Supprime ce fichier pour relancer l'évaluation.")
            return 3
        out(f"Le jeu de test a déjà été évalué le {report['date']}. Résultat enregistré, rien n'est recalculé :")
        print_report(report, out)
        return 0

    if not (artifacts / MODEL_FILE).is_file() or not (artifacts / SPLIT_FILE).is_file():
        out("Aucun modèle retenu : lance d'abord python -m ml.win.select --db <base>.")
        return 5

    split, meta = read_split(artifacts / SPLIT_FILE)
    try:
        frame = load_matches(meta["db"], min_matches=0)
        if str(frame["patch"].iloc[0]) != meta["patch"]:
            raise DatasetRejected(f"la base ne contient plus le patch {meta['patch']}")
        train = to_dataset(subset(frame, split.train))
        test = to_dataset(subset(frame, split.test))
    except MissingDatabaseError:
        out(f"Base introuvable : {meta['db']}")
        return 2
    except DatasetRejected as error:
        out(f"Base inutilisable : {error}.")
        return 3

    try:
        engine_data = load_engine_data(Path(args.seed_sql))
    except SeedDataError as error:
        out(f"Données du moteur illisibles : {error}.")
        return 4

    model_path = artifacts / MODEL_FILE
    try:
        loaded = joblib.load(model_path)
    except Exception as error:  # joblib and pickle raise many exception types on a corrupt file
        out(f"{model_path} est illisible ({error}). Relance python -m ml.win.select --db <base>.")
        return 5
    model = loaded["model"]  # a KeyError here is a real defect, not corruption
    if "priors_reference" not in loaded:
        out(
            f"{model_path} ne contient pas la référence statistiques publiques seules "
            "(fichier produit avant son ajout). Relance python -m ml.win.select --db <base>."
        )
        return 5
    priors_reference = loaded["priors_reference"]

    references = References(engine_data).fit(train.drafts, train.labels)
    report = {
        "date": now(),
        "patch": meta["patch"],
        "seed": meta["seed"],
        "train_matches": len(train),
        **evaluate(model, references, priors_reference, train, test, meta["seed"]),
    }
    report_path.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")

    print_report(report, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
