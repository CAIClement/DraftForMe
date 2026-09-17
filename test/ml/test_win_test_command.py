import json
import sqlite3
from contextlib import closing

from ml.win import test
from ml.win.baselines import References
from win_command_fixtures import run_select, world


def run_test(artifacts, seed_sql, now=lambda: "2026-09-20T10:00:00"):
    lines = []
    code = test.main(["--artifacts", str(artifacts), "--seed-sql", str(seed_sql)], out=lines.append, now=now)
    return code, lines


def test_test_refuses_to_run_before_a_model_is_chosen(tmp_path):
    _, seed_sql, artifacts = world(tmp_path)

    code, lines = run_test(artifacts, seed_sql)

    assert code == 5
    assert "ml.win.select" in lines[0]


def test_test_evaluates_once_then_only_prints_the_saved_report(tmp_path):
    # Enough test matches for the gap over the engine reference to be significant.
    db, seed_sql, artifacts = world(tmp_path, count=3000)
    run_select(db, seed_sql, artifacts)

    code, lines = run_test(artifacts, seed_sql)

    assert code == 0
    report_path = artifacts / "test_report.json"
    saved = report_path.read_bytes()
    report = json.loads(saved.decode("utf-8"))
    assert report["date"] == "2026-09-20T10:00:00"
    assert set(report["comparisons"]) == {References.ENGINE, References.WIN_RATES}
    assert set(report["comparisons_by_match"]) == {References.ENGINE, References.WIN_RATES}
    assert set(report["partial_drafts"]) == {"3", "5", "8"}
    assert set(report["by_tier_group"]) == {"iron-silver", "gold-emerald", "diamond-plus"}
    assert len(report["calibration"]) == 10
    assert report["top_weights"][0]["key"] == ["champion", "top", 101]
    assert report["comparisons"][References.ENGINE]["low"] > 0
    assert report["missing_from_engine"] == 30  # 6 champions in each of 5 roles
    assert lines[-1].startswith("Verdict")
    for line in lines:
        line.encode("cp1252")

    def fail():
        raise AssertionError("the saved report must not be recomputed")

    code, lines = run_test(artifacts, seed_sql, now=fail)

    assert code == 0
    assert "déjà été évalué le 2026-09-20T10:00:00" in lines[0]
    assert report_path.read_bytes() == saved


def test_select_refuses_to_choose_again_once_the_test_set_has_been_evaluated(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    run_select(db, seed_sql, artifacts)
    run_test(artifacts, seed_sql)
    model_before = (artifacts / "model.joblib").read_bytes()

    code, lines = run_select(db, seed_sql, artifacts)

    assert code == 5
    assert "déjà été évalué" in lines[0]
    assert (artifacts / "model.joblib").read_bytes() == model_before


def test_test_refuses_a_database_that_lost_test_matches(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    run_select(db, seed_sql, artifacts)
    test_ids = json.loads((artifacts / "split.json").read_text(encoding="utf-8"))["test"]
    with closing(sqlite3.connect(str(db))) as connection:
        connection.execute("delete from matches where match_id = ?", (test_ids[0],))
        connection.commit()

    code, lines = run_test(artifacts, seed_sql)

    assert code == 3
    assert "absentes" in lines[0]
    assert not (artifacts / "test_report.json").exists()


def test_the_verdict_uses_the_interval_grouped_by_seed_player(tmp_path):
    db, seed_sql, artifacts = world(tmp_path, count=3000)
    run_select(db, seed_sql, artifacts)

    code, lines = run_test(artifacts, seed_sql)

    assert code == 0
    report = json.loads((artifacts / "test_report.json").read_text(encoding="utf-8"))
    assert set(report["comparisons"]) == set(report["comparisons_by_match"])
    for name in report["comparisons"]:
        assert report["comparisons"][name] != report["comparisons_by_match"][name]
    expected_verdict = all(comparison["low"] > 0 for comparison in report["comparisons"].values())
    assert report["beats_references"] == expected_verdict
