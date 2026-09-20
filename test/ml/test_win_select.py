import json

import joblib
import numpy as np

from ml.win.baselines import References
from ml.win.models import BoostingDraftModel, LogisticDraftModel
from win_command_fixtures import run_select, small_candidates, world
from win_fixtures import neutral_prior, random_drafts, write_database


def test_select_saves_the_split_the_model_its_weights_and_a_validation_report(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)

    code, lines = run_select(db, seed_sql, artifacts)

    assert code == 0
    assert (artifacts / "split.json").is_file()
    assert (artifacts / "model.joblib").is_file()
    weights = json.loads((artifacts / "model_weights.json").read_text(encoding="utf-8"))
    assert weights["stage"] in (1, 2)
    report = json.loads((artifacts / "validation_report.json").read_text(encoding="utf-8"))
    assert [row["model"] for row in report["candidates"]] == [
        model.name for model in small_candidates(42, neutral_prior())
    ]
    assert {row["model"] for row in report["references"]} == {
        References.ENGINE,
        References.WIN_RATES,
        References.PRIORS_ONLY,
    }
    assert report["chosen"] in {row["model"] for row in report["candidates"]}
    assert any(line.startswith("Modèle retenu") for line in lines)
    for line in lines:
        line.encode("cp1252")


def test_select_saves_the_priors_only_reference_model_alongside_the_chosen_one(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)

    code, _ = run_select(db, seed_sql, artifacts)

    assert code == 0
    saved = joblib.load(artifacts / "model.joblib")
    assert "priors_reference" in saved
    priors_reference = saved["priors_reference"]
    assert isinstance(priors_reference, LogisticDraftModel)
    assert priors_reference.stage == 0


def test_select_removes_stale_weights_when_boosting_is_chosen(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    artifacts.mkdir()
    (artifacts / "model_weights.json").write_text("{}", encoding="utf-8")

    boosting = {"learning_rate": 0.1, "max_leaf_nodes": 15, "l2_regularization": 1.0}
    code, _ = run_select(
        db, seed_sql, artifacts, candidates=lambda seed, prior: [BoostingDraftModel(boosting, seed, prior)]
    )

    assert code == 0
    assert not (artifacts / "model_weights.json").exists()


def test_select_exit_codes_for_a_missing_database_an_unusable_one_and_missing_engine_data(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)

    assert run_select(tmp_path / "absent.sqlite", seed_sql, artifacts)[0] == 2

    small = tmp_path / "small.sqlite"
    write_database(small, random_drafts(20, np.random.default_rng(1)), np.ones(20, dtype=int))
    assert run_select(small, seed_sql, artifacts)[0] == 3

    assert run_select(db, tmp_path / "absent.sql", artifacts)[0] == 4
    assert not (artifacts / "model.joblib").exists()


def test_select_records_the_split_sizes_in_the_validation_report(tmp_path):
    count = 1500
    db, seed_sql, artifacts = world(tmp_path, count=count)

    code, _ = run_select(db, seed_sql, artifacts)

    assert code == 0
    split = json.loads((artifacts / "split.json").read_text(encoding="utf-8"))
    report = json.loads((artifacts / "validation_report.json").read_text(encoding="utf-8"))
    assert report["splits"] == {
        "train": len(split["train"]),
        "validation": len(split["validation"]),
        "test": len(split["test"]),
    }
    assert sum(report["splits"].values()) == count


def test_select_refuses_an_unusable_artifacts_path_without_a_traceback(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    artifacts.parent.mkdir(parents=True, exist_ok=True)
    artifacts.write_text("not a directory", encoding="utf-8")

    code, lines = run_select(db, seed_sql, artifacts)

    assert code == 2
    assert any("Impossible de créer le dossier" in line for line in lines)
